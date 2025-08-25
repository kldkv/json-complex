import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as converter from './jsonToJSX.js';

describe('validateObjectKey', () => {
  it('returns true for valid identifiers', () => {
    expect(converter.validateObjectKey('alpha')).toBe(true);
    expect(converter.validateObjectKey('_beta')).toBe(true);
    expect(converter.validateObjectKey('$gamma')).toBe(true);
    expect(converter.validateObjectKey('a1')).toBe(true);
    expect(converter.validateObjectKey('a_b$1')).toBe(true);
  });

  it('returns false for invalid identifiers', () => {
    expect(converter.validateObjectKey('1alpha')).toBe(false);
    expect(converter.validateObjectKey('a-b')).toBe(false);
    expect(converter.validateObjectKey('a b')).toBe(false);
    expect(converter.validateObjectKey('а')).toBe(false); // кириллица
  });
});

describe('parseArgs', () => {
  it('parses flags correctly', () => {
    const argv = [
      '-i',
      'inDir',
      '-o',
      'outDir',
      '-e',
      'jsx',
      '-p',
      '\\.mf\\.json$',
      '--imports',
      "import X from 'x'",
    ];
    const parsed = converter.parseArgs(argv);
    expect(parsed.input).toBe('inDir');
    expect(parsed.out).toBe('outDir');
    expect(parsed.ext).toBe('jsx');
    expect(parsed.pattern).toBe('\\.mf\\.json$');
    expect(parsed.imports).toBe("import X from 'x'");
  });

  it('supports positional input argument', () => {
    const argv = ['someDir'];
    const parsed = converter.parseArgs(argv);
    expect(parsed.input).toBe('someDir');
  });
});

describe('jsonToJSX', () => {
  it('generates TSX with default imports and proper props/children handling', async () => {
    const json = {
      component: 'row',
      props: {
        a: 1,
        b: true,
        c: false,
        title: 'Hello',
        obj: { 'invalid-key': 1, valid_key: 'x' },
        arr: [1, 'x', false, null, [2, 'y'], { k: 3 }],
      },
      children: ['text', { component: 'TypographyV1', props: { foo: 'bar' } }],
    };

    const code = await converter.jsonToJSX(json);

    expect(code).toContain(
      "import { Block, Content, DataRow, DataRowItem, Divider, Row, Section, TypographyV1 } from '@omega/ui-retail';",
    );
    expect(code).toMatch(/export default \(\) => \(/);
    expect(code).toContain('<RowHcms');
    expect(code).toContain('a={1}');
    expect(code).toMatch(/<RowHcms[\s\S]*\sb(\s|>)/); // true boolean prop as bare attribute
    expect(code).not.toMatch(/\sc(\s|=)/); // false boolean prop is omitted
    expect(code).toContain('title="Hello"');
    expect(code).toMatch(/["']invalid-key["']/);
    expect(code).toMatch(/<RowHcms[\s\S]*>\s*text[\s\S]*<\/RowHcms>/);
    expect(code).toContain('<TypographyV1');
  });

  it('wraps mustache-like children into expression container', async () => {
    const json = {
      component: 'row',
      children: '{{name}}',
    };
    const code = await converter.jsonToJSX(json);
    expect(code).toContain("{'{{name}}'}");
  });
});

describe('file generation', () => {
  function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'jsx-json-'));
  }

  function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
  }

  it('generateFile creates output with custom imports and default ext', async () => {
    const tmp = makeTempDir();
    const input = path.join(tmp, 'single.json');
    const data = { blocks: [{ component: 'row', children: 'ok' }] };
    writeJson(input, data);

    const outDir = path.join(tmp, 'out');
    const outPath = await converter.generateFile(input, {
      outDir,
      imports: "import React from 'react'",
    });

    expect(fs.existsSync(outPath)).toBe(true);
    const content = fs.readFileSync(outPath, 'utf8');
    expect(content).toContain("import React from 'react'");
    expect(content).toContain('<RowHcms');
  });

  it('generateFilesFromDirectory respects pattern and outDir', async () => {
    const tmp = makeTempDir();
    const dir = path.join(tmp, 'in');
    fs.mkdirSync(dir, { recursive: true });

    const aPath = path.join(dir, 'a.json');
    const bPath = path.join(dir, 'b.mf.json');
    writeJson(aPath, { blocks: [{ component: 'row', children: 'A' }] });
    writeJson(bPath, { blocks: [{ component: 'row', children: 'B' }] });

    const outDir = path.join(tmp, 'out');

    const all = await converter.generateFilesFromDirectory(dir, { outDir });
    expect(all.length).toBe(2);
    all.forEach((p) => expect(fs.existsSync(p)).toBe(true));

    const onlyMf = await converter.generateFilesFromDirectory(dir, {
      outDir,
      pattern: '\\.(mf)\\.json$',
    });
    expect(onlyMf.length).toBe(1);
    expect(path.basename(onlyMf[0])).toBe('b.mf.tsx');
    expect(fs.existsSync(onlyMf[0])).toBe(true);
  });
});
