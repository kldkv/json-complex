const fs = require('node:fs');
const path = require('node:path');
const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function getJSXNameString(nameNode) {
  if (!nameNode) return undefined;

  if (nameNode.type === 'JSXIdentifier') {
    return nameNode.name;
  }

  if (nameNode.type === 'JSXMemberExpression') {
    const object = getJSXNameString(nameNode.object);
    const property = getJSXNameString(nameNode.property);
    return `${object}.${property}`;
  }

  if (nameNode.type === 'JSXNamespacedName') {
    const namespace = getJSXNameString(nameNode.namespace);
    const name = getJSXNameString(nameNode.name);
    return `${namespace}:${name}`;
  }

  return undefined;
}

function renderJSXElement(node) {
  const props = {};
  const children = [];
  let shouldKeepArrayShape = false;

  const componentName = getJSXNameString(node.openingElement.name);

  // Получаем свойства компонента
  node.openingElement.attributes.forEach((attr) => {
    if (attr.type === 'JSXSpreadAttribute') {
      throw new SyntaxError('JSXSpreadAttribute is not supported');
    }

    if (attr.type === 'JSXAttribute') {
      if (['JSXExpressionContainer'].includes(attr.value?.type ?? '')) {
        props[attr.name.name] = getAttributeValue(attr.value.expression);
      } else if (attr.value === null) {
        props[attr.name.name] = true;
      } else {
        props[attr.name.name] = attr.value.value;
      }
    }
  });

  // Получаем дочерние элементы
  node.children.forEach((child) => {
    if (['JSXExpressionContainer'].includes(child.type)) {
      if (child.expression?.type === 'JSXEmptyExpression') {
        return;
      }
      const value = getAttributeValue(child.expression);

      const pushValue = (val) => {
        if (val === undefined || val === null || val === false) return;
        if (val === '') return;
        children.push(val);
      };

      if (Array.isArray(value)) {
        shouldKeepArrayShape = true;
        const stack = [...value];
        while (stack.length > 0) {
          const current = stack.shift();
          if (Array.isArray(current)) {
            stack.unshift(...current);
            continue;
          }
          pushValue(current);
        }
      } else {
        pushValue(value);
      }
    }

    if (child.type === 'JSXText') {
      const trimmedValue = child.value.trim();

      if (trimmedValue === '') {
        return;
      }

      children.push(trimmedValue);
    } else if (child.type === 'JSXElement') {
      children.push(renderJSXElement(child));
    } else if (child.type === 'JSXFragment') {
      children.push(renderJSXFragment(child));
    }
  });

  const result = {
    component: componentName,
  };

  if (
    Object.entries(props).filter(([key, value]) => value !== undefined).length >
    0
  ) {
    result.props = props;
  }

  if (children.length > 0) {
    result.children = children;
  }

  if (result.children?.length === 1 && !shouldKeepArrayShape) {
    result.children = result.children[0];
  }

  if (Object.prototype.hasOwnProperty.call(props, 'children')) {
    result.children = props.children;
    delete props.children;

    if (result.props && Object.keys(result.props).length === 0) {
      delete result.props;
    }
  }

  return result;
}

function renderJSXFragment(node) {
  const children = [];
  let shouldKeepArrayShape = false;

  node.children.forEach((child) => {
    if (child.type === 'JSXText') {
      const trimmedValue = child.value.trim();
      if (trimmedValue !== '') {
        children.push(trimmedValue);
      }
      return;
    }

    if (child.type === 'JSXElement') {
      children.push(renderJSXElement(child));
      return;
    }

    if (child.type === 'JSXFragment') {
      children.push(renderJSXFragment(child));
      return;
    }

    if (child.type === 'JSXExpressionContainer') {
      if (child.expression?.type === 'JSXEmptyExpression') {
        return;
      }
      const value = getAttributeValue(child.expression);
      const pushValue = (val) => {
        if (val === undefined || val === null || val === false) return;
        if (val === '') return;
        children.push(val);
      };
      if (Array.isArray(value)) {
        shouldKeepArrayShape = true;
        const stack = [...value];
        while (stack.length > 0) {
          const current = stack.shift();
          if (Array.isArray(current)) {
            stack.unshift(...current);
            continue;
          }
          pushValue(current);
        }
      } else {
        pushValue(value);
      }
      return;
    }
  });

  const result = { component: 'ReactFragment' };
  if (children.length > 0) {
    result.children = children;
  }
  if (result.children?.length === 1 && !shouldKeepArrayShape) {
    result.children = result.children[0];
  }
  return result;
}

function getAttributeValue(expression) {
  if (expression === null) {
    return true;
  }

  if (
    [
      'StringLiteral',
      'BooleanLiteral',
      'BigIntLiteral',
      'NumericLiteral',
      'Literal',
    ].includes(expression.type)
  ) {
    return expression.value;
  }

  if (['JSXExpressionContainer'].includes(expression.type)) {
    return getAttributeValue(expression.expression);
  }

  if (['ArrayExpression'].includes(expression.type)) {
    return expression.elements.map((element) => getAttributeValue(element));
  }

  if (['TemplateLiteral'].includes(expression.type)) {
    const expressions = expression.expressions.map((element) => ({
      ...element,
      value: {
        raw: element.value,
        cooked: getAttributeValue(element),
      },
    }));

    return expressions
      .concat(expression.quasis)
      .sort((elementA, elementB) => elementA.start - elementB.start)
      .reduce(
        (string, element) => `${string}${element.value.cooked.toString()}`,
        '',
      );
  }

  if (['ObjectExpression'].includes(expression.type)) {
    return expression.properties
      .map((property) => {
        if (property.type === 'SpreadElement') {
          throw new SyntaxError('SpreadElement is not supported');
        }

        if (property.computed) {
          throw new SyntaxError('ComputedProperty is not supported');
        }

        let key;
        if (property.key.type === 'Identifier') {
          key = property.key.name;
        } else if (
          ['StringLiteral', 'NumericLiteral', 'Literal'].includes(
            property.key.type,
          )
        ) {
          key = property.key.value;
        } else {
          throw new SyntaxError(`${property.key.type} key is not supported`);
        }

        const value = getAttributeValue(property.value);

        if (key === undefined || value === undefined) {
          return null;
        }

        return { key, value };
      })
      .filter((property) => property)
      .reduce((properties, property) => {
        return { ...properties, [property.key]: property.value };
      }, {});
  }

  if (['JSXElement'].includes(expression.type)) {
    return renderJSXElement(expression);
  }

  if (['JSXFragment'].includes(expression.type)) {
    return renderJSXFragment(expression);
  }

  if (['NullLiteral'].includes(expression.type)) {
    return null;
  }

  if (['Identifier'].includes(expression.type)) {
    if (expression.name === 'undefined') {
      return undefined;
    }

    throw new SyntaxError('Identifier is not supported');
  }

  throw new SyntaxError(`${expression.type} is not supported`);
}

function transformNode(node) {
  if (node.type === 'JSXElement') {
    return renderJSXElement(node);
  }
  if (node.type === 'JSXFragment') {
    return renderJSXFragment(node);
  }
}

// Основная функция для преобразования JSX в JSON
function transformJSXToJson(jsx, currentFile) {
  try {
    let parseWrapped = false;
    let ast;
    try {
      ast = babelParser.parse(jsx, {
        sourceType: 'module',
        plugins: ['jsx'],
      });
    } catch (parseError) {
      // Попытка обернуть смежные JSX-узлы во фрагмент
      if (
        parseError?.code === 'BABEL_PARSER_SYNTAX_ERROR' &&
        parseError?.reasonCode === 'UnwrappedAdjacentJSXElements'
      ) {
        parseWrapped = true;
        ast = babelParser.parse(`<>${jsx}</>`, {
          sourceType: 'module',
          plugins: ['jsx'],
        });
      } else {
        throw parseError;
      }
    }

    let jsonResult;

    traverse(ast, {
      JSXFragment(path) {
        if (!jsonResult && !parseWrapped) {
          jsonResult = transformNode(path.node);
          path.stop();
        }
      },
      JSXElement(path) {
        jsonResult = transformNode(path.node);
        path.stop(); // Остановить обход после первого найденного элемента
      },
    });

    return jsonResult;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

// =========================
// Функции для генерации файлов/директорий (без CLI)
// =========================

function ensureDirectoryExists(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveOutputPath(inputFilePath, outDir, ext = 'json') {
  const extension = ext.startsWith('.') ? ext : `.${ext}`;
  const baseName = path.basename(inputFilePath, path.extname(inputFilePath));
  const targetDir =
    outDir || path.join(path.dirname(inputFilePath), '_generated_json');
  ensureDirectoryExists(targetDir);
  return path.join(targetDir, `${baseName}${extension}`);
}

function readJsxSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function formatJsonOutput(data, indent = 2) {
  const space = Number.isFinite(indent) ? Number(indent) : 2;
  return JSON.stringify(data, null, space);
}

function generateFile(inputFilePath, options = {}) {
  const {
    outDir,
    ext = 'json',
    wrapBlocks = false,
    wrapKey = 'blocks',
    indent = 2,
  } = options;
  const jsxSource = readJsxSource(inputFilePath);
  const json = transformJSXToJson(jsxSource);
  const dataToWrite = wrapBlocks ? { [wrapKey]: [json] } : json;
  const outputPath = resolveOutputPath(inputFilePath, outDir, ext);
  fs.writeFileSync(outputPath, formatJsonOutput(dataToWrite, indent), 'utf8');
  return outputPath;
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

function generateFilesFromDirectory(baseDir, options = {}) {
  const {
    pattern = '\\.[tj]sx$',
    outDir,
    ext = 'json',
    wrapBlocks = false,
    wrapKey = 'blocks',
    indent = 2,
    recursive = false,
  } = options;
  if (!baseDir) throw new Error('baseDir is required');

  let fileRegex;
  try {
    fileRegex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
  } catch (_) {
    fileRegex = /\\.[tj]sx$/;
  }

  const files = (
    recursive ? listFilesRecursive(baseDir) : listFilesShallow(baseDir)
  ).filter((fullPath) => fileRegex.test(path.basename(fullPath)));

  const outputs = files.map((fullPath) =>
    generateFile(fullPath, { outDir, ext, wrapBlocks, wrapKey, indent }),
  );
  return outputs;
}

module.exports = {
  transformJSXToJson,
  generateFile,
  generateFilesFromDirectory,
};
