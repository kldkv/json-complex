import { test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
// @ts-expect-error: JS module without types is fine for tests
import transformTsxToJson from './convert.mjs';

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();
const baseDir = path.join(projectRoot, 'src/__test__');

function listTsxRecursive(dir: string): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...listTsxRecursive(full));
    } else if (e.isFile() && /\.tsx$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

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

function loadExpectedSync(filePath: string) {
  const sourceCode = fs.readFileSync(filePath, 'utf-8');
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

function loadMetaSync(filePath: string) {
  const sourceCode = fs.readFileSync(filePath, 'utf-8');
  const ast = parse(sourceCode, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const meta: any = {};
  for (const node of ast.program.body) {
    if (node.type === 'ExportNamedDeclaration' && node.declaration && node.declaration.type === 'VariableDeclaration') {
      for (const decl of node.declaration.declarations) {
        if (decl.id.type === 'Identifier' && decl.init && decl.init.type === 'StringLiteral') {
          if (decl.id.name === 'name') meta.name = decl.init.value;
          if (decl.id.name === 'description') meta.description = decl.init.value;
        }
      }
    }
  }
  return meta;
}

const tsxFiles = listTsxRecursive(baseDir).filter((p) => {
  try {
    loadExpectedSync(p);
    return true;
  } catch {
    return false;
  }
});

test.each(tsxFiles)('convert.mjs produces JSON equal to _expected (without meta): %s', async (filePath) => {
  const sourceCode = fs.readFileSync(filePath, 'utf-8');
  const result = await transformTsxToJson(sourceCode, filePath);
  const expected = loadExpectedSync(filePath);
  // удаляем мета из expected, чтобы сравнить только структуру JSX-экспортов
  const { name: _n, description: _d, ...expectedNoMeta } = expected as any;
  expect(result).toEqual(expectedNoMeta);
});

test.each(tsxFiles)('cli.mjs generates JSON equal to expected (with meta): %s', async (filePath) => {
  const cliPath = path.join(projectRoot, 'src/cli.mjs');
  const { stdout } = await execFileAsync('node', [cliPath, '-i', filePath]);
  const outputPath = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
  const result = JSON.parse(fs.readFileSync(outputPath!, 'utf-8'));
  const expected = loadExpectedSync(filePath);
  const meta = loadMetaSync(filePath);
  const { name: _n, description: _d, ...expectedNoMeta } = expected as any;
  const expectedWithMeta: any = {
    name: meta.name,
    description: meta.description,
    ...expectedNoMeta,
  };
  const { lastModified, ...resultNoTime } = result;
  expect(resultNoTime).toEqual(expectedWithMeta);
});


