#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  transformJSXToJson,
  generateFile,
  generateFilesFromDirectory,
} = require('./transformJSXToJson.js');

function printUsage() {
  const usage = `Usage: jsx-to-json [options]

Options:
  -i, --input <path>       Вход: файл .jsx/.tsx или директория (обязательно)
  -o, --out-dir <dir>      Директория вывода (по умолчанию _generated_json рядом с входом)
  -e, --ext <ext>          Расширение результата (по умолчанию json)
  -p, --pattern <regex>    Фильтр файлов при обработке директории (по умолчанию ([tj])sx$)
  -r, --recursive          Рекурсивно обходить директории
  -w, --wrap-blocks        Обернуть результат в { blocks: [ ... ] }
  --wrap-key <key>         Ключ для обертки вместо "blocks" (по умолчанию blocks)
  -n, --indent <spaces>    Отступ в JSON (по умолчанию 2)
  -h, --help               Показать справку

Примеры:
  jsx-to-json -i ./src/components/Card.tsx
  jsx-to-json -i ./src/components -o ./out -e json -p "([tj])sx$" -r -w -n 2`;
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
      case '-w':
      case '--wrap-blocks':
        args.wrapBlocks = true;
        break;
      case '--wrap-key':
        args.wrapKey = argv[++i];
        break;
      case '-n':
      case '--indent':
        args.indent = Number(argv[++i]);
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
    pattern: parsed.pattern || '([tj])sx$',
    recursive: Boolean(parsed.recursive),
    wrapBlocks: Boolean(parsed.wrapBlocks),
    wrapKey: parsed.wrapKey || 'blocks',
    indent: Number.isFinite(parsed.indent) ? parsed.indent : 2,
  };

  try {
    if (fs.statSync(inputPath).isFile()) {
      const outPath = generateFile(inputPath, options);
      // eslint-disable-next-line no-console
      console.log(outPath);
    } else {
      const outputs = generateFilesFromDirectory(inputPath, options);
      // eslint-disable-next-line no-console
      outputs.forEach((p) => console.log(p));
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err.message || err);
    process.exit(1);
  }
})();
