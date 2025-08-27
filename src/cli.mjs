#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import { fileURLToPath } from 'node:url';
import * as babelParser from '@babel/parser';
import transformTsxToJson from './convert.mjs';

function printUsage() {
  const usage = `Usage: jsx-json-logic [options]

Options:
  -i, --input <path>       Вход: файл .jsx/.tsx или директория (обязательно)
  -o, --out-dir <dir>      Директория вывода (по умолчанию _generated_json рядом с входом)
  -e, --ext <ext>          Расширение результата (по умолчанию json)
  -p, --pattern <regex>    Фильтр файлов при обработке директории (по умолчанию ([tj])sx$)
  -r, --recursive          Рекурсивно обходить директории
  -w, --watch              Наблюдение за изменениями и авто-перегенерация
  -h, --help               Показать справку

Примеры:
  jsx-json-logic -i ./src/components/Card.tsx
  jsx-json-logic -i ./src/components -o ./out -e json -p "([tj])sx$" -r -w -n 2`;
  // eslint-disable-next-line no-console
  console.log(usage);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '-i':
      case '--input':
        args.input = argv[++i];
        break;
      case '-o':
      case '--out-dir':
        args.outDir = argv[++i];
        break;
      case '-e':
      case '--ext':
        args.ext = argv[++i];
        break;
      case '-p':
      case '--pattern':
        args.pattern = argv[++i];
        break;
      case '-r':
      case '--recursive':
        args.recursive = true;
        break;
      case '-n':
      case '--indent':
        args.indent = Number(argv[++i]);
        break;
      case '-k':
      case '--key':
        // Параметр больше не используется, пропускаем значение для совместимости
        i += 1;
        break;
      case '-w':
      case '--watch':
        args.watch = true;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      default:
        args._.push(token);
    }
  }
  if (!args.input && args._.length > 0) {
    args.input = args._[0];
  }
  return args;
}

function ensureDirectoryExists(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveOutputPath(inputFilePath, outDir, ext = 'json', baseNameOverride) {
  const extension = ext.startsWith('.') ? ext : `.${ext}`;
  const baseName = baseNameOverride || path.basename(inputFilePath, path.extname(inputFilePath));
  const targetDir =
    outDir || path.join(path.dirname(inputFilePath), '_generated_json');
  ensureDirectoryExists(targetDir);
  return path.join(targetDir, `${baseName}${extension}`);
}

function listFilesRecursive(dirPath) {
  const result = [];
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        result.push(full);
      }
    }
  }
  return result;
}

function listFilesShallow(dirPath) {
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((file) => !file.isDirectory())
    .map((file) => path.join(dirPath, file.name));
}

function compileFileRegex(pattern) {
  try {
    return pattern instanceof RegExp ? pattern : new RegExp(pattern);
  } catch (_) {
    return /([tj])sx$/;
  }
}

function parseModule(source) {
  return babelParser.parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

// Из convert.mjs мы формируем JSON целиком, поэтому выделять корневой JSX не требуется

function astToLiteral(node) {
  if (!node) return undefined;
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value;
    case 'NullLiteral':
      return null;
    case 'TemplateLiteral': {
      let out = '';
      const quasis = node.quasis;
      const exprs = node.expressions;
      for (let i = 0; i < quasis.length; i++) {
        out += quasis[i].value.cooked || '';
        if (i < exprs.length) {
          const v = astToLiteral(exprs[i]);
          out += v == null ? '' : String(v);
        }
      }
      return out;
    }
    case 'ArrayExpression':
      return node.elements.map((el) => (el ? astToLiteral(el) : null));
    case 'ObjectExpression': {
      const obj = {};
      for (const prop of node.properties) {
        if (prop.type !== 'ObjectProperty') continue;
        const key =
          prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
        obj[key] = astToLiteral(prop.value);
      }
      return obj;
    }
    default:
      return undefined;
  }
}

function extractMetaFromSource(source) {
  const ast = parseModule(source);
  const locals = new Map();
  for (const node of ast.program.body) {
    if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        if (decl.id?.type === 'Identifier' && decl.init) {
          locals.set(decl.id.name, decl.init);
        }
      }
    }
  }
  const meta = {};
  for (const node of ast.program.body) {
    if (node.type !== 'ExportNamedDeclaration') continue;
    if (node.declaration?.type === 'VariableDeclaration') {
      for (const decl of node.declaration.declarations) {
        if (decl.id?.type !== 'Identifier' || !decl.init) continue;
        const name = decl.id.name;
        if (name === 'name') meta.name = astToLiteral(decl.init);
        if (name === 'description') meta.description = astToLiteral(decl.init);
        if (name === 'data') meta.data = astToLiteral(decl.init);
      }
    }
    if (
      !node.declaration &&
      Array.isArray(node.specifiers) &&
      node.specifiers.length > 0 &&
      !node.source
    ) {
      for (const spec of node.specifiers) {
        if (spec.type !== 'ExportSpecifier') continue;
        const localName = spec.local.name;
        const exportedName = spec.exported.name;
        if (!['name', 'description', 'data'].includes(exportedName)) continue;
        const init = locals.get(localName);
        if (!init) continue;
        if (exportedName === 'name') meta.name = astToLiteral(init);
        if (exportedName === 'description')
          meta.description = astToLiteral(init);
        if (exportedName === 'data') meta.data = astToLiteral(init);
      }
    }
  }
  return meta;
}

async function formatJsonWithPrettier(jsonText, outputPath) {
  try {
    const prettier = await import('prettier');
    const config = await prettier.resolveConfig(outputPath).catch(() => null);
    return prettier.format(jsonText, { ...(config || {}), parser: 'json' });
  } catch (_) {
    return jsonText;
  }
}

// Упростили пайплайн: инлайнинг и преобразование выполняются в convert.mjs

// Больше не нужен внешний загрузчик трансформера

async function generateForFile(inputFilePath, options) {
  const { outDir, ext = 'json' } = options;
  const source = fs.readFileSync(inputFilePath, 'utf8');
  const json = await transformTsxToJson(source, inputFilePath);
  const stat = fs.statSync(inputFilePath);
  const meta = extractMetaFromSource(source);
  const fileBase = meta.name ?? path.basename(inputFilePath, path.extname(inputFilePath));
  const outputPath = resolveOutputPath(inputFilePath, outDir, ext, fileBase);
  const root = {
    name: fileBase,
    lastModified: stat.mtime.toISOString(),
    ...(meta.description !== undefined ? { description: meta.description } : {}),
    ...(meta.data !== undefined ? { data: meta.data } : {}),
    ...json,
  };
  const raw = JSON.stringify(root, null, 2);
  const formatted = await formatJsonWithPrettier(raw, outputPath);
  fs.writeFileSync(outputPath, formatted, 'utf8');
  return outputPath;
}

async function generateForDirectory(baseDir, options) {
  const {
    pattern = 'tsx$',
    outDir,
    ext = 'json',
    recursive = false,
  } = options;
  const fileRegex = compileFileRegex(pattern);
  const files = (
    recursive ? listFilesRecursive(baseDir) : listFilesShallow(baseDir)
  ).filter((fullPath) => fileRegex.test(path.basename(fullPath)));
  const outputs = [];
  for (const full of files) {
    const out = await generateForFile(
      full,
      { outDir, ext, key: options.key },
    );
    outputs.push(out);
  }
  return outputs;
}

function watchPath(inputPath, options, onChange) {
  const watchGlobs = fs.statSync(inputPath).isFile()
    ? [inputPath, path.join(path.dirname(inputPath), '**/*.{js,ts,jsx,tsx}')]
    : [
        path.join(
          inputPath,
          options.recursive ? '**/*.{js,ts,jsx,tsx}' : '*.{js,ts,jsx,tsx}',
        ),
      ];

  const watcher = chokidar.watch(watchGlobs, {
    ignoreInitial: true,
    ignored: /node_modules/,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 },
  });

  const debounceTimers = new Map();
  const debounce = (key, fn, ms = 50) => {
    const prev = debounceTimers.get(key);
    if (prev) clearTimeout(prev);
    const tmr = setTimeout(fn, ms);
    debounceTimers.set(key, tmr);
  };

  watcher.on('add', (p) => debounce('all', () => onChange('add', p)));
  watcher.on('change', (p) => debounce(p, () => onChange('change', p)));
  watcher.on('unlink', (p) => debounce('all', () => onChange('unlink', p)));

  return watcher;
}

(async () => {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printUsage();
    process.exit(0);
  }

  if (!parsed.input) {
    // eslint-disable-next-line no-console
    console.error('Error: --input обязателен');
    printUsage();
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), parsed.input);
  if (!fs.existsSync(inputPath)) {
    // eslint-disable-next-line no-console
    console.error(`Error: путь не найден: ${inputPath}`);
    process.exit(1);
  }

  const options = {
    outDir: parsed.outDir,
    ext: parsed.ext || 'json',
    pattern: parsed.pattern || 'tsx$',
    recursive: Boolean(parsed.recursive),
    watch: Boolean(parsed.watch),
  };

  async function runOnce() {
    try {
      if (fs.statSync(inputPath).isFile()) {
        const outPath = await generateForFile(inputPath, options);
        // eslint-disable-next-line no-console
        console.log(outPath);
      } else {
        const outputs = await generateForDirectory(
          inputPath,
          options,
        );
        // eslint-disable-next-line no-console
        outputs.forEach((p) => console.log(p));
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err.message || err);
    }
  }

  await runOnce();

  if (options.watch) {
    // eslint-disable-next-line no-console
    console.log('Watching for changes...');
    const fileRegex = compileFileRegex(options.pattern || 'tsx$');
    watchPath(inputPath, options, async (_evt, changedPath) => {
      try {
        const stat = fs.existsSync(inputPath) ? fs.statSync(inputPath) : null;
        if (stat && stat.isFile()) {
          const out = await generateForFile(inputPath, options);
          // eslint-disable-next-line no-console
          console.log(out);
          return;
        }
        if (!changedPath || !fileRegex.test(path.basename(changedPath))) return;
        const out = await generateForFile(changedPath, options);
        // eslint-disable-next-line no-console
        console.log(out);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err.message || err);
      }
    });
  }
})();


