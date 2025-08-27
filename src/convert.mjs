import { transformSync } from '@babel/core';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import { pathToFileURL } from 'node:url';

// 1) Прочитаем исходник (TSX)
const sourcePath = './src/mainCases/realLife.tsx';
const sourceCode = fs.readFileSync(sourcePath, 'utf-8');

// 2) Разберём AST исходного TSX, чтобы извлечь JSX для ui
const ast = parse(sourceCode, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript', 'optionalChaining', 'nullishCoalescingOperator', 'logicalAssignment'],
});

async function buildImportsScope(program, filePath) {
  const imports = new Map();
  const fileDir = path.dirname(path.resolve(filePath));
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    const source = node.source.value;
    // Игнорируем только React-рантайм, он не нужен для вычисления выражений
    if (source === 'react' || source === 'react/jsx-dev-runtime') continue;

    try {
      const mod = source.startsWith('.')
        ? await import(pathToFileURL(path.resolve(fileDir, source)).href)
        : await import(source);
      for (const s of node.specifiers) {
        if (s.type === 'ImportSpecifier') {
          imports.set(s.local.name, mod[s.imported.name]);
        } else if (s.type === 'ImportDefaultSpecifier') {
          imports.set(s.local.name, mod.default);
        } else if (s.type === 'ImportNamespaceSpecifier') {
          imports.set(s.local.name, mod);
        }
      }
    } catch {
      // Если модуль не удалось импортировать (например, среда без пакета), пропускаем
    }
  }
  return imports;
}

function jsxNameToString(name) {
  if (!name) return '';
  switch (name.type) {
    case 'JSXIdentifier':
      return name.name;
    case 'JSXMemberExpression':
      return `${jsxNameToString(name.object)}.${jsxNameToString(name.property)}`;
    case 'JSXNamespacedName':
      return `${name.namespace.name}:${name.name.name}`;
    default:
      return '';
  }
}

function evaluateExpression(node, scope, imports) {
  if (!node) return undefined;
  switch (node.type) {
    case 'ParenthesizedExpression':
      return evaluateExpression(node.expression, scope, imports);
    case 'JSXElement':
      return convertJsxElementToJson(node, scope, imports);
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value;
    case 'BigIntLiteral':
      return BigInt(node.value);
    case 'NullLiteral':
      return null;
    case 'Identifier':
      if (scope.has(node.name)) return scope.get(node.name);
      if (imports && imports.has(node.name)) return imports.get(node.name);
      if (node.name === 'undefined') return undefined;
      if (node.name === 'Date') return Date;
      return undefined;
    case 'TemplateLiteral': {
      let out = '';
      const { quasis, expressions } = node;
      for (let i = 0; i < quasis.length; i += 1) {
        out += quasis[i].value.cooked ?? '';
        if (i < expressions.length) {
          const v = evaluateExpression(expressions[i], scope, imports);
          if (v === undefined) return undefined;
          out += String(v);
        }
      }
      return out;
    }
    case 'BinaryExpression': {
      const left = evaluateExpression(node.left, scope, imports);
      const right = evaluateExpression(node.right, scope, imports);
      switch (node.operator) {
        case '+':
          return (left ?? undefined) !== undefined && (right ?? undefined) !== undefined ? left + right : undefined;
        case '-':
          return (left ?? undefined) !== undefined && (right ?? undefined) !== undefined ? left - right : undefined;
        case '*':
          return (left ?? undefined) !== undefined && (right ?? undefined) !== undefined ? left * right : undefined;
        case '/':
          return (left ?? undefined) !== undefined && (right ?? undefined) !== undefined ? left / right : undefined;
        case '%':
          return (left ?? undefined) !== undefined && (right ?? undefined) !== undefined ? left % right : undefined;
        case '**':
          return (left ?? undefined) !== undefined && (right ?? undefined) !== undefined ? left ** right : undefined;
        case '<':
          return left < right;
        case '<=':
          return left <= right;
        case '>':
          return left > right;
        case '>=':
          return left >= right;
        case '==':
          return left == right; // eslint-disable-line eqeqeq
        case '!=':
          return left != right; // eslint-disable-line eqeqeq
        case '===':
          return left === right;
        case '!==':
          return left !== right;
        case 'in':
          try { return left in right; } catch { return undefined; }
        case 'instanceof':
          try { return left instanceof right; } catch { return undefined; }
        default:
          return undefined;
      }
    }
    case 'LogicalExpression': {
      const left = evaluateExpression(node.left, scope, imports);
      switch (node.operator) {
        case '&&':
          return left && evaluateExpression(node.right, scope, imports);
        case '||':
          return left || evaluateExpression(node.right, scope, imports);
        case '??':
          return (left !== null && left !== undefined) ? left : evaluateExpression(node.right, scope, imports);
        default:
          return undefined;
      }
    }
    case 'ChainExpression': {
      return evaluateExpression(node.expression, scope, imports);
    }
    case 'OptionalMemberExpression': {
      const obj = evaluateExpression(node.object, scope, imports);
      if (obj === null || obj === undefined) return undefined;
      const propName = node.computed
        ? evaluateExpression(node.property, scope, imports)
        : node.property.name;
      try { return obj[propName]; } catch { return undefined; }
    }
    case 'UnaryExpression': {
      const arg = evaluateExpression(node.argument, scope, imports);
      switch (node.operator) {
        case '!':
          return !arg;
        case '+':
          return +arg;
        case '-':
          return -arg;
        default:
          return undefined;
      }
    }
    case 'ConditionalExpression': {
      const test = evaluateExpression(node.test, scope, imports);
      if (test) return evaluateExpression(node.consequent, scope, imports);
      return evaluateExpression(node.alternate, scope, imports);
    }
    case 'MemberExpression': {
      const obj = evaluateExpression(node.object, scope, imports);
      if (obj === undefined || obj === null) return undefined;
      const propName = node.computed
        ? evaluateExpression(node.property, scope, imports)
        : node.property.name;
      try {
        return obj[propName];
      } catch {
        return undefined;
      }
    }
    case 'CallExpression': {
      // Сначала обрабатываем вызов метода, чтобы сохранить корректный this
      if (node.callee.type === 'MemberExpression') {
        const obj = evaluateExpression(node.callee.object, scope, imports);
        const propName = node.callee.computed
          ? evaluateExpression(node.callee.property, scope, imports)
          : node.callee.property.name;
        const fn = obj?.[propName];
        const args = node.arguments.map((a) => evaluateExpression(a, scope, imports));
        if (typeof fn === 'function') return fn.apply(obj, args);
        return undefined;
      }
      const callee = evaluateExpression(node.callee, scope, imports);
      const args = node.arguments.map((a) => evaluateExpression(a, scope, imports));
      if (typeof callee === 'function') {
        return callee(...args);
      }
      return undefined;
    }
    case 'NewExpression': {
      const Ctor = evaluateExpression(node.callee, scope, imports);
      const args = node.arguments.map((a) => evaluateExpression(a, scope, imports));
      if (typeof Ctor === 'function') {
        return new Ctor(...args);
      }
      return undefined;
    }
    case 'ObjectExpression': {
      const obj = {};
      for (const prop of node.properties) {
        if (prop.type === 'ObjectProperty') {
          const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
          const val = evaluateExpression(prop.value, scope, imports);
          obj[key] = val;
        }
      }
      return obj;
    }
    case 'ArrayExpression': {
      return node.elements.map((el) => {
        if (!el) return undefined;
        if (el.type === 'JSXElement') return convertJsxElementToJson(el, scope, imports);
        return evaluateExpression(el, scope, imports);
      });
    }
    case 'ArrowFunctionExpression': {
      return (...args) => {
        const child = new Map(scope);
        node.params.forEach((p, i) => {
          if (p.type === 'Identifier') child.set(p.name, args[i]);
        });
        if (node.body.type === 'BlockStatement') {
          // Поддержка только return в конце
          const ret = node.body.body.find((s) => s.type === 'ReturnStatement');
          return ret ? evaluateExpression(ret.argument, child, imports) : undefined;
        }
        return evaluateExpression(node.body, child, imports);
      };
    }
    default:
      return undefined;
  }
}

function buildTopLevelConstScope(program, imports) {
  const scope = new Map();
  const handleVarDecl = (varDecl) => {
    for (const decl of varDecl.declarations) {
      if (decl.id.type === 'Identifier' && decl.init) {
        const jsx = unwrapJsx(decl.init);
        if (jsx) {
          const value = convertJsxElementToJson(jsx, scope, imports);
          scope.set(decl.id.name, value);
          continue;
        }
        const value = evaluateExpression(decl.init, scope, imports);
        scope.set(decl.id.name, value);
      }
    }
  };
  for (const node of program.body) {
    if (node.type === 'VariableDeclaration' && (node.kind === 'const' || node.kind === 'let' || node.kind === 'var')) {
      handleVarDecl(node);
      continue;
    }
    if (node.type === 'ExportNamedDeclaration' && node.declaration && node.declaration.type === 'VariableDeclaration') {
      handleVarDecl(node.declaration);
      continue;
    }
  }
  return scope;
}

function convertJsxElementToJson(jsxEl, scope, imports) {
  // Если это функциональный компонент из scope/imports, рендерим его и возвращаем результат
  if (jsxEl.openingElement.name.type === 'JSXIdentifier') {
    const idName = jsxEl.openingElement.name.name;
    const compCandidate = scope.has(idName) ? scope.get(idName) : (imports && imports.get ? imports.get(idName) : undefined);
    if (typeof compCandidate === 'function') {
      // Соберём props как объект
      const propsObj = {};
      for (const attr of jsxEl.openingElement.attributes) {
        if (attr.type === 'JSXAttribute') {
          const propName = attr.name.name;
          if (attr.value == null) {
            propsObj[propName] = true;
          } else if (attr.value.type === 'StringLiteral') {
            propsObj[propName] = attr.value.value;
          } else if (attr.value.type === 'JSXExpressionContainer') {
            const val = evaluateExpression(attr.value.expression, scope, imports);
            propsObj[propName] = val === undefined ? null : val;
          }
        }
      }
      // Дети → props.children
      const ch = [];
      for (const child of jsxEl.children) {
        if (child.type === 'JSXText') {
          const text = child.value.replace(/\s+/g, ' ').trim();
          if (text) ch.push(text);
        } else if (child.type === 'JSXElement') {
          ch.push(convertJsxElementToJson(child, scope, imports));
        } else if (child.type === 'JSXExpressionContainer') {
          const val = evaluateExpression(child.expression, scope, imports);
          if (val !== undefined && val !== null && val !== false) ch.push(val);
        }
      }
      if (ch.length === 1) propsObj.children = ch[0];
      else if (ch.length > 0) propsObj.children = ch;

      try {
        const rendered = compCandidate(propsObj);
        // Если компонент вернул JSX как JSON, отдаём его
        if (rendered && typeof rendered === 'object') return rendered;
      } catch {
        // Фоллбек к обычной сериализации элемента
      }
    }
  }

  // Обычный JSX-элемент (DOM или неизвестный компонент)
  const name = jsxNameToString(jsxEl.openingElement.name);
  const result = { component: name };

  // props
  const props = {};
  for (const attr of jsxEl.openingElement.attributes) {
    if (attr.type === 'JSXAttribute') {
      const propName = attr.name.name;
      if (attr.value == null) {
        props[propName] = true;
      } else if (attr.value.type === 'StringLiteral') {
        props[propName] = attr.value.value;
      } else if (attr.value.type === 'JSXExpressionContainer') {
        const val = evaluateExpression(attr.value.expression, scope, imports);
        props[propName] = val === undefined ? null : val;
      }
    }
    // JSXSpreadAttribute — пропускаем для простоты
  }
  if (Object.keys(props).length > 0) {
    result.props = props;
  }

  // children
  const children = [];
  for (const child of jsxEl.children) {
    if (child.type === 'JSXText') {
      const text = child.value.replace(/\s+/g, ' ').trim();
      if (text) children.push(text);
    } else if (child.type === 'JSXElement') {
      children.push(convertJsxElementToJson(child, scope, imports));
    } else if (child.type === 'JSXExpressionContainer') {
      const val = evaluateExpression(child.expression, scope, imports);
      if (val !== undefined && val !== null && val !== false) children.push(val);
    }
  }

  if (children.length === 1) {
    // Схлопываем одиночного ребёнка (примитив или элемент)
    result.children = children[0];
  } else if (children.length > 0) {
    result.children = children;
  }

  return result;
}

function unwrapJsx(node) {
  if (!node) return null;
  if (node.type === 'JSXElement') return node;
  if (node.type === 'ParenthesizedExpression') return unwrapJsx(node.expression);
  return null;
}

function findDefaultJsx(program) {
  for (const node of program.body) {
    if (node.type === 'ExportDefaultDeclaration') {
      const unwrapped = unwrapJsx(node.declaration);
      if (unwrapped) return unwrapped;
      if (node.declaration.type === 'Identifier') {
        const targetName = node.declaration.name;
        // Поиск объявления переменной с таким именем
        for (const s of program.body) {
          if (s.type === 'VariableDeclaration') {
            for (const d of s.declarations) {
              if (d.id.type === 'Identifier' && d.id.name === targetName && d.init) {
                const el = unwrapJsx(d.init);
                if (el) return el;
              }
            }
          }
        }
      }
    }
  }
  return null;
}

function findFirstJsx(program) {
  const stack = [...program.body];
  while (stack.length) {
    const n = stack.pop();
    if (!n) continue;
    if (n.type === 'JSXElement') return n;
    // раскрываем вложенные поля
    for (const key in n) {
      const v = n[key];
      if (v && typeof v === 'object') {
        if (Array.isArray(v)) stack.push(...v);
        else stack.push(v);
      }
    }
  }
  return null;
}

const importsScope = await buildImportsScope(ast.program, sourcePath);
const topLevelScope = buildTopLevelConstScope(ast.program, importsScope);
const defaultJsx = findDefaultJsx(ast.program);
const ui = defaultJsx ? convertJsxElementToJson(defaultJsx, topLevelScope, importsScope) : undefined;

// Поиск именованных экспортов-React элементов, чтобы позволить менять ключ (например, block)
function findNamedJsxExports(program) {
  const out = {};
  for (const node of program.body) {
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      if (node.declaration.type === 'VariableDeclaration') {
        for (const d of node.declaration.declarations) {
          if (d.id.type === 'Identifier' && d.init) {
            const el = unwrapJsx(d.init);
            if (el) out[d.id.name] = el;
          }
        }
      }
    }
  }
  return out;
}

const namedJsxExports = findNamedJsxExports(ast.program);
// Примонтируем именованные JSX константы в scope, чтобы их можно было использовать в props как идентификаторы
for (const [key, jsxNode] of Object.entries(namedJsxExports)) {
  if (!topLevelScope.has(key)) {
    topLevelScope.set(key, convertJsxElementToJson(jsxNode, topLevelScope, importsScope));
  }
}

// 3) Подготовим код для вычисления ИМЕНОВАННЫХ экспортов без UI-зависимостей
//    - удалим export default
//    - удалим импорт из 'antd' и 'react', т.к. они нужны только для JSX
const evalAst = parse(sourceCode, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

function containsJsx(n) {
  let has = false;
  const stack = [n];
  while (stack.length) {
    const curr = stack.pop();
    if (!curr || has) continue;
    if (curr.type === 'JSXElement' || curr.type === 'JSXFragment') { has = true; break; }
    for (const key in curr) {
      const v = curr[key];
      if (v && typeof v === 'object') {
        if (Array.isArray(v)) stack.push(...v);
        else stack.push(v);
      }
    }
  }
  return has;
}

evalAst.program.body = evalAst.program.body.flatMap((node) => {
  if (node.type === 'ExportDefaultDeclaration') return [];
  if (node.type === 'ImportDeclaration') {
    const src = node.source.value;
    if (src === 'react' || src === 'react/jsx-dev-runtime') return [];
    return [node];
  }
  if (node.type === 'VariableDeclaration') {
    const decls = node.declarations.filter((d) => !containsJsx(d.init));
    if (decls.length === 0) return [];
    return [{ ...node, declarations: decls }];
  }
  if (node.type === 'ExportNamedDeclaration' && node.declaration && node.declaration.type === 'VariableDeclaration') {
    const decls = node.declaration.declarations.filter((d) => !containsJsx(d.init));
    if (decls.length === 0) return [];
    return [{ ...node, declaration: { ...node.declaration, declarations: decls } }];
  }
  return [node];
});

const { code: evalSource } = generate.default ? generate.default(evalAst) : generate(evalAst);

const { code: esmEvalCode } = transformSync(evalSource, {
    plugins: [
      ['@babel/plugin-transform-typescript', { isTSX: true }],
  ],
  // оставляем ESM модули нетронутыми
  ast: false,
  code: true,
  sourceMaps: false,
});

// 4) Запишем во временный .mjs и динамически импортируем
const projectRoot = process.cwd();
const tmpDir = path.join(projectRoot, '.json-complex-tmp');
fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'module-eval.mjs');
fs.writeFileSync(tmpFile, esmEvalCode, 'utf-8');

const fileUrl = pathToFileURL(tmpFile).href;
const runtimeModule = await import(fileUrl);

// 5) Сформируем итоговый объект: все именованные экспорты + ui
const result = {};
for (const [key, value] of Object.entries(runtimeModule)) {
  if (key === 'default' || key === '_expected' || key.startsWith('_')) continue;
  result[key] = value;
}
// добавим все именованные JSX-экспорты (включая ui/notUI/block и т.п.)
for (const [key, jsxNode] of Object.entries(namedJsxExports)) {
  if (key === '_expected') continue;
  result[key] = convertJsxElementToJson(jsxNode, topLevelScope, importsScope);
}
// export default -> ui, но не перезаписываем, если есть именованный ui
if (ui !== undefined && result.ui === undefined) result.ui = ui;

console.log(JSON.stringify(result, null, 2));

