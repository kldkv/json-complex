import { test, expect, describe } from 'vitest';
import { transoformWithLogic } from './main.js';
import * as cases from './mainCases/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import generate from '@babel/generator';

describe('someFn', () => {
  test.each(Object.values(cases).map(({ name, jsx }) => [name, jsx]))(
    'Render %s',
    (name, filePath) => {
      const jsxText = extractJsxExpressionString(filePath);
      expect(transoformWithLogic(jsxText, filePath)).toEqual(
        requireCase(filePath).expected,
      );
    },
  );
});

function extractJsxExpressionString(filePath) {
  const src = fs.readFileSync(path.resolve(filePath), 'utf8');
  const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  let jsxNode = null;
  for (const node of ast.program.body) {
    if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration?.type === 'VariableDeclaration'
    ) {
      for (const decl of node.declaration.declarations) {
        if (decl.id?.type === 'Identifier' && decl.id.name === 'jsx') {
          jsxNode = decl.init;
          break;
        }
      }
    }
    if (jsxNode) break;
  }
  if (!jsxNode) throw new Error('No jsx export found in case: ' + filePath);
  const { code } = generate.default
    ? generate.default(jsxNode)
    : generate(jsxNode);
  return code;
}

function requireCase(filePath) {
  // Загружаем модуль как ESM-строку и парсим expected через простое извлечение
  // Так как .jsx — это просто файл с экспортами, безопасно выполнить через eval в песочнице нельзя.
  // Упростим: из исходника достаём блок `export const expected = ...;`
  const src = fs.readFileSync(path.resolve(filePath), 'utf8');
  const m = src.match(/export const expected\s*=\s*([\s\S]*?);\s*$/m);
  if (!m) throw new Error('No expected found in case: ' + filePath);
  // eslint-disable-next-line no-new-func
  const obj = new Function('return (' + m[1] + ')')();
  return { expected: obj };
}
