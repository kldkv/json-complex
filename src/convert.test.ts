import { test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, 'src/mainCases/realLife.tsx');
const convertScript = path.join(projectRoot, 'src/convert.mjs');

function evalLiteralAst(node: any): any {
  switch (node.type) {
    case 'ObjectExpression': {
      const obj: any = {};
      for (const prop of node.properties) {
        if (prop.type === 'ObjectProperty') {
          const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
          obj[key] = evalLiteralAst(prop.value);
        }
      }
      return obj;
    }
    case 'ArrayExpression':
      return node.elements.map((el: any) => evalLiteralAst(el));
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value;
    case 'NullLiteral':
      return null;
    default:
      throw new Error(`Unsupported node in _expected: ${node.type}`);
  }
}

function loadExpectedSync() {
  const sourceCode = fs.readFileSync(sourcePath, 'utf-8');
  const ast = parse(sourceCode, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  for (const node of ast.program.body) {
    if (node.type === 'ExportNamedDeclaration' && node.declaration && node.declaration.type === 'VariableDeclaration') {
      for (const decl of node.declaration.declarations) {
        if (decl.id.type === 'Identifier' && decl.id.name === '_expected') {
          return evalLiteralAst(decl.init as any);
        }
      }
    }
  }
  throw new Error('Cannot find _expected in source');
}

test.skip('convert.mjs produces JSON equal to _expected', async () => {
  const [{ stdout }] = await Promise.all([
    execFileAsync('node', [convertScript]),
  ]);
  const expected = loadExpectedSync();
  const result = JSON.parse(stdout);
  expect(result).toEqual(expected);
});


