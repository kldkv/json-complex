import cjs from './transformJSXToJson/transformJSXToJson.js';
import { transformJsToJsonLogic } from './transformJsToJsonLogic/transformJsToJsonLogic.js';
import { parse, parseExpression } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import generateModule from '@babel/generator';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;
const { transformJSXToJson } = cjs;

export function transoformWithLogic(jsxString, caseFilePath) {
  // Сначала пытаемся вычислить выражения в JSX с учётом констант/функций из файла кейса
  const ctx = buildCaseContext(caseFilePath);
  const preAttrInlined = inlineAttributeCallsViaAst(jsxString, ctx);
  const preInlinedCalls = inlineKnownZeroArgCalls(preAttrInlined, ctx);
  const preEvaluated = evaluateJsxExpressions(preInlinedCalls, ctx);
  const parsed = transformJSXToJson(preEvaluated);

  const replaceTemplatesWithPlaceholders = (source) => {
    let index = 0;
    const placeholders = new Map();
    const text = String(source).replace(/\{\{([^}]+)\}\}/g, (_, inner) => {
      const key = `__T${index++}`;
      placeholders.set(key, `{{${inner}}}`);
      return key;
    });
    return { text, placeholders };
  };

  const restorePlaceholdersInJsonLogic = (rule, placeholders) => {
    if (!rule || placeholders.size === 0) return rule;
    const visit = (node) => {
      if (node == null) return node;
      if (Array.isArray(node)) return node.map(visit);
      if (typeof node !== 'object') return node;
      if (Object.prototype.hasOwnProperty.call(node, 'var')) {
        const name = node.var;
        if (typeof name === 'string' && placeholders.has(name)) {
          return { var: placeholders.get(name) };
        }
        return node;
      }
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = visit(v);
      return out;
    };
    return visit(rule);
  };

  const isUsefulParsedExpression = (str) => {
    if (typeof str !== 'string') return false;
    const s = str.trim();
    if (s.length === 0) return false;
    // Защита от даты вида YYYY-MM-DD или YYYY-MM-DD HH:mm(:ss)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) return false;
    try {
      const { text } = replaceTemplatesWithPlaceholders(s);
      const node = parseExpression(text, {
        sourceType: 'script',
        plugins: [
          'bigInt',
          'optionalChaining',
          'nullishCoalescingOperator',
          'classProperties',
          'classPrivateProperties',
          'classPrivateMethods',
          'numericSeparator',
          'logicalAssignment',
          'importMeta',
        ],
      });
      // Преобразуем только «настоящие выражения», исключаем одиночные литералы и идентификаторы
      const allowed = new Set([
        'BinaryExpression',
        'LogicalExpression',
        'ConditionalExpression',
        'UnaryExpression',
        'ArrayExpression',
        'ObjectExpression',
        'CallExpression',
        'OptionalCallExpression',
        'MemberExpression',
        'OptionalMemberExpression',
        'TemplateLiteral',
        'ChainExpression',
        'CoalesceExpression',
      ]);
      return allowed.has(node.type);
    } catch (_) {
      return false;
    }
  };

  const tryToJsonLogic = (value) => {
    if (!isUsefulParsedExpression(value)) return value;
    try {
      const { text, placeholders } = replaceTemplatesWithPlaceholders(
        String(value),
      );
      const json = transformJsToJsonLogic(text);
      return restorePlaceholdersInJsonLogic(json, placeholders);
    } catch (_) {
      return value;
    }
  };

  const transformAny = (value) => {
    if (value == null) return value;
    if (typeof value === 'string') return tryToJsonLogic(value);
    if (Array.isArray(value)) return value.map((v) => transformAny(v));
    if (typeof value === 'object') {
      // Специальная обработка JSX-узла { component, props?, children? }
      if (Object.prototype.hasOwnProperty.call(value, 'component')) {
        const compName = value.component;
        const nextProps =
          value.props && typeof value.props === 'object'
            ? Object.fromEntries(
                Object.entries(value.props).map(([k, v]) => [
                  k,
                  transformAny(v),
                ]),
              )
            : undefined;
        const nextChildren = Object.prototype.hasOwnProperty.call(
          value,
          'children',
        )
          ? transformAny(value.children)
          : undefined;
        // Для компонента Show нормализуем форму: component: 'Show', children: <inner>
        if (compName === 'Show') {
          const normalized = { component: 'Show' };
          if (nextProps && Object.keys(nextProps).length)
            normalized.props = nextProps;
          if (nextChildren !== undefined) normalized.children = nextChildren;
          return normalized;
        }
        const out = { component: compName };
        if (nextProps && Object.keys(nextProps).length) out.props = nextProps;
        if (nextChildren !== undefined) out.children = nextChildren;
        return out;
      }
      // Обычный объект: трансформируем значения
      const next = {};
      for (const [k, v] of Object.entries(value)) next[k] = transformAny(v);
      return next;
    }
    return value;
  };

  // Возвращаем трансформированный результат (для Show и вложенных Show применяется нормализация)
  return transformAny(parsed);
}

function inlineKnownZeroArgCalls(jsxText, ctx) {
  let result = String(jsxText);
  const sandbox = createSandboxContext(ctx);
  // Предварительно компилируем функции в песочницу
  try {
    compileFunctionsIntoContext(ctx, sandbox);
  } catch (_) {}
  for (const [name, fnAst] of Object.entries(ctx.funcs)) {
    const paramsLen = Array.isArray(fnAst.params) ? fnAst.params.length : 0;
    if (paramsLen !== 0) continue;
    // Попробуем вычислить без аргументов в песочнице
    let value;
    try {
      value = sandboxEvalCode(`${name}()`, ctx, sandbox);
    } catch (_) {
      continue;
    }

    const pattern = new RegExp(`\{\s*${name}\s*\(\s*\)\s*\}`, 'g');
    const replacement =
      typeof value === 'string'
        ? `{${JSON.stringify(value)}}`
        : typeof value === 'number'
          ? `{${String(value)}}`
          : typeof value === 'boolean'
            ? `{${value ? 'true' : 'false'}}`
            : typeof value === 'bigint'
              ? `{${JSON.stringify(value.toString())}}`
              : undefined;
    if (replacement !== undefined)
      result = result.replace(pattern, replacement);
  }
  return result;
}

function inlineAttributeCallsViaAst(jsxText, ctx) {
  try {
    const program = parse(`const __x = ${jsxText};`, {
      sourceType: 'module',
      plugins: ['jsx'],
    });
    const decl = program.program.body[0];
    traverse(program, {
      JSXAttribute(path) {
        const val = path.node.value;
        if (!val || val.type !== 'JSXExpressionContainer') return;
        const expr = val.expression;
        if (!expr) return;
        // Если значение атрибута — идентификатор на локальную переменную с JSX/массивом JSX — подставляем AST напрямую
        if (expr.type === 'Identifier' && ctx.vars && ctx.vars[expr.name]) {
          const init = ctx.vars[expr.name];
          if (
            init.type === 'JSXElement' ||
            init.type === 'JSXFragment' ||
            init.type === 'ArrayExpression'
          ) {
            val.expression = t.cloneNode(init, true);
            return;
          }
        }
        // Пробуем вычислить любое выражение в атрибуте
        const res = tryEvalExpression(expr, ctx);
        if (res && res.__computed) {
          const value = res.value;
          // запрет на функции/символы/BigInt
          if (typeof value === 'function')
            throw new Error('Function value is not supported');
          if (typeof value === 'symbol')
            throw new Error('Symbol value is not supported');
          const node = valueToAstNode(value);
          if (node) val.expression = node;
        }
      },
    });
    return generate(decl.declarations[0].init).code;
  } catch (_) {
    return jsxText;
  }
}

function valueToAstNode(value) {
  const tpe = typeof value;
  if (tpe === 'function' || tpe === 'symbol') return null;
  if (tpe === 'bigint') return t.stringLiteral(value.toString());
  if (tpe === 'string') return t.stringLiteral(value);
  if (tpe === 'number') return t.numericLiteral(value);
  if (tpe === 'boolean') return t.booleanLiteral(value);
  if (value === null) return t.nullLiteral();
  if (isDateObject(value)) return t.stringLiteral(value.toISOString());
  if (Array.isArray(value))
    return t.arrayExpression(value.map((v) => valueToAstNode(v)));
  if (tpe === 'object') {
    const props = Object.entries(value).map(([k, v]) =>
      t.objectProperty(t.stringLiteral(k), valueToAstNode(v)),
    );
    return t.objectExpression(props);
  }
  // undefined -> null
  if (value === undefined) return t.nullLiteral();
  return null;
}

function buildCaseContext(caseFilePath) {
  const ctx = { consts: {}, funcs: {}, vars: {} };
  if (!caseFilePath) return ctx;
  try {
    const abs = path.resolve(caseFilePath);
    const src = fs.readFileSync(abs, 'utf8');
    const ast = parse(src, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    // импортируемые функции/константы из utils и др.
    for (const node of ast.program.body) {
      if (node.type === 'ImportDeclaration') {
        const importedPath = resolveImport(abs, node.source.value);
        if (importedPath) {
          const { funcs, consts, vars } = readExportsFromFile(importedPath);
          // алиасы локальных имён
          for (const spec of node.specifiers) {
            if (spec.type !== 'ImportSpecifier') continue;
            const local = spec.local.name;
            const importedName = spec.imported.name;
            if (funcs[importedName]) ctx.funcs[local] = funcs[importedName];
            if (consts[importedName] !== undefined)
              ctx.consts[local] = consts[importedName];
            if (vars && vars[importedName])
              ctx.vars[local] = vars[importedName];
          }
        }
      }
    }
    for (const node of ast.program.body) {
      if (node.type !== 'VariableDeclaration') continue;
      for (const decl of node.declarations) {
        if (!decl.id || decl.id.type !== 'Identifier') continue;
        const name = decl.id.name;
        const init = decl.init;
        if (!init) continue;
        if (init.type === 'ArrowFunctionExpression') {
          ctx.funcs[name] = init;
          continue;
        }
        // Сохраняем AST инициализатора переменной для возможной ленивой оценки
        ctx.vars[name] = init;
        // Пытаемся вычислить константу сразу (поддерживаются безопасные выражения)
        const computed = tryEvalExpression(init, ctx);
        if (computed && computed.__computed) {
          ctx.consts[name] = computed.value;
        }
      }
    }
    // собственные экспорты файла (если есть)
    const own = readExportsFromAst(ast);
    Object.assign(ctx.funcs, own.funcs);
    Object.assign(ctx.consts, own.consts);
    if (own.vars) Object.assign(ctx.vars, own.vars);
  } catch (_) {}
  return ctx;
}

function resolveImport(fromFileAbs, source) {
  try {
    if (!source.startsWith('.')) return null;
    const baseDir = path.dirname(fromFileAbs);
    const raw = path.resolve(baseDir, source);
    const candidates = [
      raw,
      raw + '.js',
      raw + '.mjs',
      raw + '.cjs',
      raw + '.ts',
      raw + '.tsx',
      raw + '.jsx',
      path.join(raw, 'index.js'),
      path.join(raw, 'index.ts'),
      path.join(raw, 'index.tsx'),
    ];
    for (const p of candidates) if (fs.existsSync(p)) return p;
  } catch (_) {}
  return null;
}

function readExportsFromFile(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
    return readExportsFromAst(ast);
  } catch (_) {
    return { funcs: {}, consts: {}, vars: {} };
  }
}

function readExportsFromAst(ast) {
  const out = { funcs: {}, consts: {}, vars: {} };
  const locals = { funcs: {}, consts: {}, vars: {} };
  // Сначала собираем локальные объявления
  for (const node of ast.program.body) {
    if (node.type === 'FunctionDeclaration' && node.id?.type === 'Identifier') {
      locals.funcs[node.id.name] = node;
      continue;
    }
    if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        if (decl.id?.type !== 'Identifier' || !decl.init) continue;
        const name = decl.id.name;
        const init = decl.init;
        if (
          init.type === 'StringLiteral' ||
          init.type === 'NumericLiteral' ||
          init.type === 'BooleanLiteral'
        ) {
          locals.consts[name] = init.value;
          // сохраняем также AST init
          locals.vars[name] = init;
          continue;
        }
        if (init.type === 'ArrowFunctionExpression') {
          locals.funcs[name] = init;
          continue;
        }
        // сохраняем AST инициализатора как var
        locals.vars[name] = init;
      }
    }
  }
  // Затем читаем экспорты
  for (const node of ast.program.body) {
    if (node.type !== 'ExportNamedDeclaration') continue;
    if (node.declaration?.type === 'VariableDeclaration') {
      for (const decl of node.declaration.declarations) {
        if (decl.id?.type !== 'Identifier' || !decl.init) continue;
        const name = decl.id.name;
        const init = decl.init;
        if (
          init.type === 'StringLiteral' ||
          init.type === 'NumericLiteral' ||
          init.type === 'BooleanLiteral'
        ) {
          out.consts[name] = init.value;
          out.vars[name] = init;
          continue;
        }
        if (init.type === 'ArrowFunctionExpression') {
          out.funcs[name] = init;
          continue;
        }
        out.vars[name] = init;
      }
    }
    if (node.declaration?.type === 'FunctionDeclaration') {
      const fn = node.declaration;
      if (fn.id?.type === 'Identifier') out.funcs[fn.id.name] = fn;
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
        if (locals.funcs[localName])
          out.funcs[exportedName] = locals.funcs[localName];
        if (locals.consts[localName] !== undefined)
          out.consts[exportedName] = locals.consts[localName];
        if (locals.vars[localName])
          out.vars[exportedName] = locals.vars[localName];
      }
    }
  }
  return out;
}

function evaluateJsxExpressions(jsxText, ctx) {
  try {
    const program = parse(`const __x = ${jsxText};`, {
      sourceType: 'module',
      plugins: ['jsx'],
    });
    const decl = program.program.body[0];
    traverse(program, {
      JSXExpressionContainer(path) {
        const expr = path.node.expression;
        if (!expr) return;
        // Пропускаем выражения, содержащие JSX внутри
        if (containsJsx(expr)) return;
        const result = tryEvalExpression(expr, ctx);
        if (result && result.__computed) {
          const v = result.value;
          if (typeof v === 'string') path.node.expression = t.stringLiteral(v);
          else if (typeof v === 'number')
            path.node.expression = t.numericLiteral(v);
          else if (typeof v === 'boolean')
            path.node.expression = t.booleanLiteral(v);
          else if (typeof v === 'bigint')
            path.node.expression = t.stringLiteral(v.toString());
          else if (isDateObject(v))
            path.node.expression = t.stringLiteral(v.toISOString());
          else if (Array.isArray(v) || (v && typeof v === 'object'))
            path.node.expression = valueToAstNode(v);
        } else if (result && result.__error) {
          throw result.error;
        }
      },
    });
    const code = generate(decl.declarations[0].init).code;
    return code;
  } catch (e) {
    // Если не удалось безопасно вычислить — бросаем ошибку
    throw e;
  }
}

function tryEvalExpression(node, ctx, local = {}) {
  // Сначала пробуем детерминированный упрощённый эмулятор AST
  try {
    const v = evalNode(node, ctx, local);
    return { __computed: true, value: v };
  } catch (_) {}
  // Затем универсальная песочница vm с таймаутом
  try {
    const value = sandboxEvalAst(node, ctx);
    // Запрещаем функции/символы
    if (typeof value === 'function' || typeof value === 'symbol') {
      return {
        __error: true,
        error: new Error('Unsupported computed value (function/symbol)'),
      };
    }
    return { __computed: true, value };
  } catch (error) {
    return { __error: true, error };
  }
}

function evalNode(node, ctx, local) {
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value;
    case 'UnaryExpression': {
      if (node.operator === '!') {
        const v = evalNode(node.argument, ctx, local);
        if (typeof v !== 'boolean') throw new Error('Unary ! expects boolean');
        return !v;
      }
      throw new Error('Unsupported unary operator: ' + node.operator);
    }
    case 'Identifier': {
      if (Object.prototype.hasOwnProperty.call(local, node.name))
        return local[node.name];
      if (Object.prototype.hasOwnProperty.call(ctx.consts, node.name))
        return ctx.consts[node.name];
      if (node.name === 'undefined') return undefined;
      throw new Error('Unknown identifier: ' + node.name);
    }
    case 'TemplateLiteral': {
      let out = '';
      const quasis = node.quasis;
      const exprs = node.expressions;
      for (let i = 0; i < quasis.length; i++) {
        out += quasis[i].value.cooked || '';
        if (i < exprs.length) out += String(evalNode(exprs[i], ctx, local));
      }
      return out;
    }
    case 'ArrayExpression': {
      return node.elements.map((el) => (el ? evalNode(el, ctx, local) : null));
    }
    case 'ObjectExpression': {
      const out = {};
      for (const prop of node.properties) {
        if (prop.type !== 'ObjectProperty')
          throw new Error('Unsupported object property');
        const key =
          prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
        out[key] = evalNode(prop.value, ctx, local);
      }
      return out;
    }
    case 'NullLiteral': {
      return null;
    }
    case 'ConditionalExpression': {
      const test = evalNode(node.test, ctx, local);
      return test
        ? evalNode(node.consequent, ctx, local)
        : evalNode(node.alternate, ctx, local);
    }
    case 'BinaryExpression': {
      if (node.operator !== '+')
        throw new Error('Unsupported operator: ' + node.operator);
      const l = evalNode(node.left, ctx, local);
      const r = evalNode(node.right, ctx, local);
      if (typeof l === 'number' && typeof r === 'number') return l + r;
      return String(l) + String(r);
    }
    case 'CallExpression': {
      if (node.callee.type === 'Identifier') {
        const fnName = node.callee.name;
        const fnAst = ctx.funcs[fnName];
        if (!fnAst) throw new Error('Unknown function: ' + fnName);
        const args = node.arguments.map((a) => evalNode(a, ctx, local));
        if (fnAst.type === 'ArrowFunctionExpression') {
          const params = fnAst.params.map((p) =>
            p.type === 'Identifier' ? p.name : null,
          );
          const innerLocal = { ...local };
          for (let i = 0; i < params.length; i++)
            if (params[i]) innerLocal[params[i]] = args[i];
          return evalNode(fnAst.body, ctx, innerLocal);
        }
        if (fnAst.type === 'FunctionDeclaration') {
          const params = fnAst.params.map((p) =>
            p.type === 'Identifier' ? p.name : null,
          );
          const innerLocal = { ...local };
          for (let i = 0; i < params.length; i++)
            if (params[i]) innerLocal[params[i]] = args[i];
          const ret = (fnAst.body.body || []).find(
            (s) => s.type === 'ReturnStatement',
          );
          if (!ret || !ret.argument) throw new Error('Function has no return');
          return evalNode(ret.argument, ctx, innerLocal);
        }
        throw new Error('Unsupported function node');
      }
      if (node.callee.type === 'MemberExpression') {
        // Поддержка new Date('YYYY-MM-DD').toLocaleString()
        const obj = evalNode(node.callee.object, ctx, local);
        const property =
          node.callee.property.type === 'Identifier'
            ? node.callee.property.name
            : null;
        if (obj && obj.__type === 'Date') {
          if (property === 'toString') {
            return obj.value.toString();
          }
          throw new Error(
            'Date values are not supported. Convert Date to string explicitly.',
          );
        }
        throw new Error('Unsupported member call');
      }
      throw new Error('Unsupported callee');
    }
    case 'NewExpression': {
      if (node.callee.type === 'Identifier' && node.callee.name === 'Date') {
        const arg0 = node.arguments[0]
          ? evalNode(node.arguments[0], ctx, local)
          : undefined;
        const d = arg0 ? new Date(arg0) : new Date();
        return { __type: 'Date', value: d };
      }
      throw new Error('Unsupported constructor');
    }
    case 'MemberExpression': {
      // Читаем только имя свойства, вычисление производим на этапе вызова
      const obj = evalNode(node.object, ctx, local);
      const prop =
        node.property.type === 'Identifier' ? node.property.name : null;
      return { __member: true, object: obj, property: prop };
    }
    default:
      throw new Error('Unsupported expression: ' + node.type);
  }
}

export default { someFn: transoformWithLogic };

// ===== Универсальная песочница и вспомогательные утилиты =====

const SANDBOX_TIMEOUT_MS = 50;

function isDateObject(v) {
  return (
    v &&
    typeof v === 'object' &&
    Object.prototype.toString.call(v) === '[object Date]'
  );
}

function createSandboxContext(ctx) {
  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
  };
  // Примитивные константы сразу
  for (const [k, v] of Object.entries(ctx.consts || {})) sandbox[k] = v;
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  const context = vm.createContext(sandbox);
  try {
    installDeterministicDate(context);
  } catch (_) {}
  return context;
}

function compileFunctionsIntoContext(ctx, context) {
  for (const [name, fnAst] of Object.entries(ctx.funcs || {})) {
    try {
      let code;
      if (fnAst.type === 'ArrowFunctionExpression') {
        code = `(${generate(fnAst).code})`;
      } else if (fnAst.type === 'FunctionDeclaration' && fnAst.id?.name) {
        const fnCode = generate(fnAst).code;
        code = `${fnCode}; ${fnAst.id.name}`;
      } else {
        continue;
      }
      const script = new vm.Script(code);
      const fn = script.runInContext(context, { timeout: SANDBOX_TIMEOUT_MS });
      if (typeof fn === 'function') context[name] = fn;
    } catch (_) {}
  }
}

function sandboxEvalAst(astNode, ctx) {
  const code = `(${generate(astNode).code})`;
  return sandboxEvalCode(code, ctx);
}

function sandboxEvalCode(code, ctx, existingContext) {
  const context = existingContext || createSandboxContext(ctx);
  // Предварительно компилируем все известные функции
  try {
    compileFunctionsIntoContext(ctx, context);
  } catch (_) {}

  // Пытаться лениво вычислять недостающие переменные из ctx.vars при ReferenceError
  const missingVarRegex = /([^\s]+) is not defined/;
  const tried = new Set();
  for (let i = 0; i < 10; i++) {
    try {
      const script = new vm.Script(code);
      const res = script.runInContext(context, { timeout: SANDBOX_TIMEOUT_MS });
      return normalizeSandboxValue(res);
    } catch (err) {
      const msg = err && err.message ? String(err.message) : '';
      const m = msg.match(missingVarRegex);
      if (m && m[1] && ctx.vars && ctx.vars[m[1]] && !tried.has(m[1])) {
        const varName = m[1];
        tried.add(varName);
        try {
          const initAst = ctx.vars[varName];
          // Не пытаемся исполнять JSX инициализаторы в песочнице
          if (containsJsx(initAst)) throw err;
          const initCode = `(${generate(initAst).code})`;
          const initScript = new vm.Script(initCode);
          const value = initScript.runInContext(context, {
            timeout: SANDBOX_TIMEOUT_MS,
          });
          context[varName] = normalizeSandboxValue(value);
          continue; // повторить попытку вычисления выражения
        } catch (_) {
          throw err;
        }
      }
      throw err;
    }
  }
  // При слишком многих попытках
  const script = new vm.Script(code);
  return script.runInContext(context, { timeout: SANDBOX_TIMEOUT_MS });
}

function normalizeSandboxValue(value) {
  const tpe = typeof value;
  if (tpe === 'function' || tpe === 'symbol') return value;
  if (tpe === 'bigint') return value; // дальше преобразуем в AST как строку
  if (isDateObject(value)) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map((v) => normalizeSandboxValue(v));
  if (value && tpe === 'object') {
    // Пытаемся сделать обычный объект с примитивами/массивами
    const out = {};
    for (const [k, v] of Object.entries(value))
      out[k] = normalizeSandboxValue(v);
    return out;
  }
  return value;
}

function installDeterministicDate(context) {
  const script = new vm.Script(`
    (function() {
      const __BaseDate = Date;
      function __fmt(d) {
        try {
          return __BaseDate.prototype
            .toISOString.call(d)
            .slice(0, 19)
            .replace('T', ' ');
        } catch (e) { return d.toString(); }
      }
      class __SandboxDate extends __BaseDate {
        constructor(...args) { super(...args); }
        toLocaleString(...args) { return __fmt(this); }
      }
      // Копируем полезные статики
      __SandboxDate.now = __BaseDate.now.bind(__BaseDate);
      __SandboxDate.parse = __BaseDate.parse.bind(__BaseDate);
      __SandboxDate.UTC = __BaseDate.UTC.bind(__BaseDate);
      // Переопределяем Date в контексте
      globalThis.Date = __SandboxDate;
    })();
  `);
  script.runInContext(context, { timeout: SANDBOX_TIMEOUT_MS });
}

// Проверка, содержит ли узел JSX внутри (на любом уровне)
function containsJsx(node) {
  if (!node) return false;
  const type = node.type;
  if (type === 'JSXElement' || type === 'JSXFragment') return true;
  switch (type) {
    case 'ArrayExpression':
      return node.elements.some((el) => el && containsJsx(el));
    case 'ObjectExpression':
      return node.properties.some(
        (p) => p.type === 'ObjectProperty' && containsJsx(p.value),
      );
    case 'JSXExpressionContainer':
      return containsJsx(node.expression);
    case 'ConditionalExpression':
      return (
        containsJsx(node.test) ||
        containsJsx(node.consequent) ||
        containsJsx(node.alternate)
      );
    case 'CallExpression':
      return (
        containsJsx(node.callee) || node.arguments.some((a) => containsJsx(a))
      );
    case 'MemberExpression':
      return containsJsx(node.object);
    case 'TemplateLiteral':
      return node.expressions.some((e) => containsJsx(e));
    case 'UnaryExpression':
      return containsJsx(node.argument);
    case 'BinaryExpression':
    case 'LogicalExpression':
      return containsJsx(node.left) || containsJsx(node.right);
    case 'NewExpression':
      return (
        containsJsx(node.callee) || node.arguments.some((a) => containsJsx(a))
      );
    default:
      return false;
  }
}


