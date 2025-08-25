const generate = require('@babel/generator').default;
const t = require('@babel/types');
const prettier = require('prettier');
const fs = require('node:fs');
const path = require('node:path');

function validateObjectKey(key) {
  const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

  // Если строка является валидным идентификатором, возвращаем как есть
  return validIdentifierRegex.test(key);
}

const DEFAULT_IMPORTS =
  "import { Block, Content, DataRow, DataRowItem, Divider, Row, Section, TypographyV1 } from '@omega/ui-retail';";

function buildObjectExpression(obj) {
  return t.objectExpression(
    Object.entries(obj).map(([key, value]) =>
      t.objectProperty(
        !validateObjectKey(key) ? t.stringLiteral(key) : t.identifier(key),
        typeof value === 'string'
          ? t.stringLiteral(value)
          : buildExpression(value),
      ),
    ),
  );
}

function buildArrayExpression(array) {
  return t.arrayExpression(array.map((item) => buildExpression(item)));
}

function buildExpression(value) {
  if (value === null) return t.nullLiteral();
  switch (typeof value) {
    case 'string':
      return t.stringLiteral(value);
    case 'number':
      return t.numericLiteral(value);
    case 'boolean':
      return t.booleanLiteral(value);
    case 'object':
      if (Array.isArray(value)) return buildArrayExpression(value);
      return buildObjectExpression(value);
    default:
      return t.valueToNode(value);
  }
}

function normalizeComponentName(component) {
  const firstLetter = component.charAt(0);
  return firstLetter === firstLetter.toLowerCase()
    ? `${firstLetter.toUpperCase()}${component.slice(1)}Hcms`
    : component;
}

async function jsonToJSX(json, options = {}) {
  const { imports } = options;
  function createJSXElement(data) {
    if (!data) return null;

    // Обработка примитивных значений
    if (typeof data !== 'object') {
      return t.jsxText(String(data));
    }

    const { component, props = {}, children } = data;

    // Создаем JSX атрибуты
    const jsxAttributes = Object.entries(props)
      .map(([key, value]) => {
        if (typeof value === 'boolean') {
          return value ? t.jsxAttribute(t.jsxIdentifier(key)) : null;
        }
        if (typeof value === 'string') {
          return t.jsxAttribute(t.jsxIdentifier(key), t.stringLiteral(value));
        }
        const expression = buildExpression(value);
        return t.jsxAttribute(
          t.jsxIdentifier(key),
          t.jsxExpressionContainer(expression),
        );
      })
      .filter(Boolean);

    // Обработка children
    let jsxChildren = [];
    if (Array.isArray(children)) {
      jsxChildren = children
        .map((child) => createJSXElement(child))
        .filter(Boolean);
    } else if (children) {
      if (
        typeof children === 'string' &&
        children.includes('{{') &&
        children.includes('}}')
      ) {
        jsxChildren.push(t.jsxExpressionContainer(t.stringLiteral(children)));
        // jsxAttributes.push(t.jsxAttribute(t.jsxIdentifier('children'), t.stringLiteral(children)));
      } else {
        const child = createJSXElement(children);

        if (child) {
          jsxChildren.push(child);
        }
      }
    }

    const componentName = normalizeComponentName(component);
    // Создаем JSX элемент
    return t.jsxElement(
      t.jsxOpeningElement(
        t.jsxIdentifier(componentName),
        jsxAttributes,
        jsxChildren.length === 0,
      ),
      jsxChildren.length > 0
        ? t.jsxClosingElement(t.jsxIdentifier(componentName))
        : null,
      jsxChildren,
      false,
    );
  }
  // Создаем AST
  const ast = t.program([t.expressionStatement(createJSXElement(json))]);

  // Генерируем код
  const output = generate(ast, {
    jsonCompatibleStrings: true,
    jsescOption: {
      minimal: true,
      quotes: 'single',
      es6: true,
      json: true,
    },
  });

  return await prettier.format(
    `
  ${imports || DEFAULT_IMPORTS}

  export default () => (${output.code.substring(0, output.code.length - 1)})
    `,
    {
      endOfLine: 'lf',
      parser: 'babel',
      printWidth: 30000000,
      semi: true,
      singleAttributePerLine: true,
      singleQuote: true,
    },
  );
}

const pathToServiceList = './src/App/content/tbcv/mf-service-info';

function ensureDirectoryExists(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveOutputPath(inputFilePath, outDir, ext) {
  const extension = ext.startsWith('.') ? ext : `.${ext}`;
  const baseName = path.basename(inputFilePath, path.extname(inputFilePath));
  const targetDir =
    outDir || path.join(path.dirname(inputFilePath), '_generated_jsx');
  ensureDirectoryExists(targetDir);
  return path.join(targetDir, `${baseName}${extension}`);
}

function readJsonData(filePath) {
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(fileContents);
  if (
    parsed &&
    parsed.blocks &&
    Array.isArray(parsed.blocks) &&
    parsed.blocks.length > 0
  ) {
    return parsed.blocks[0];
  }
  return parsed;
}

async function generateFile(inputFilePath, options = {}) {
  const { outDir, ext = 'tsx', imports } = options;
  const data = readJsonData(inputFilePath);
  const result = await jsonToJSX(data, { imports });
  const outputPath = resolveOutputPath(inputFilePath, outDir, ext);
  fs.writeFileSync(outputPath, result, 'utf8');
  return outputPath;
}

async function generateFilesFromDirectory(
  baseDir = pathToServiceList,
  options = {},
) {
  const { pattern = '\\.json$', outDir, ext = 'tsx', imports } = options;
  let fileRegex;
  try {
    fileRegex = new RegExp(pattern);
  } catch (_) {
    fileRegex = /\.json$/;
  }

  const contentList = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((file) => !file.isDirectory())
    .filter((file) => fileRegex.test(file.name));

  const outputs = await Promise.all(
    contentList.map((file) => {
      const currentPath = path.join(baseDir, file.name);
      return generateFile(currentPath, { outDir, ext, imports });
    }),
  );
  return outputs;
}

function printUsage() {
  const usage = `Usage: node src/jsonToJSX.js [options]

Options:
  -i, --in <path>        Входной путь: файл JSON или директория
  -o, --out <dir>        Директория для вывода (по умолчанию _generated_jsx рядом с файлом)
  -e, --ext <ext>        Расширение результирующих файлов (по умолчанию tsx)
  -p, --pattern <regex>  Регулярка для отбора файлов при входной директории (по умолчанию \.json$)
      --imports <code>   Строка импорта, вставляемая в начало файла TSX
  -h, --help             Показать эту справку

Примеры:
  node src/jsonToJSX.js -i ./data/file.json
  node src/jsonToJSX.js -i ./data/jsons -o ./out -e tsx -p "\\.mf\\.json$" --imports "import React from 'react'"`;
  // eslint-disable-next-line no-console
  console.log(usage);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '-i':
      case '--in':
        args.input = argv[++i];
        break;
      case '-o':
      case '--out':
        args.out = argv[++i];
        break;
      case '-e':
      case '--ext':
        args.ext = argv[++i];
        break;
      case '-p':
      case '--pattern':
        args.pattern = argv[++i];
        break;
      case '--imports':
        args.imports = argv[++i];
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

if (require.main === module) {
  (async () => {
    const parsed = parseArgs(process.argv.slice(2));
    if (parsed.help) {
      printUsage();
      process.exit(0);
    }
    const inputPath = parsed.input || pathToServiceList;
    const options = {
      outDir: parsed.out,
      ext: parsed.ext || 'tsx',
      pattern: parsed.pattern || '\\.json$',
      imports: parsed.imports,
    };

    if (fs.existsSync(inputPath) && fs.statSync(inputPath).isFile()) {
      await generateFile(inputPath, options);
    } else {
      await generateFilesFromDirectory(inputPath, options);
    }
  })();
}

module.exports = {
  jsonToJSX,
  generateFilesFromDirectory,
  generateFile,
  parseArgs,
  validateObjectKey,
};
