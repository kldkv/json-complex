import { test, expect, describe, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, 'src/mainCases/realLife.tsx');
const convertScript = path.join(projectRoot, 'src/convert.mjs');

let originalSource = '';

beforeAll(() => {
  originalSource = fs.readFileSync(sourcePath, 'utf-8');
});

afterAll(() => {
  fs.writeFileSync(sourcePath, originalSource, 'utf-8');
});

async function runConvert(defaultJsx, extra = '') {
  const fileContent = `${extra}\nexport default ${defaultJsx};\n`;
  fs.writeFileSync(sourcePath, fileContent, 'utf-8');
  const { stdout } = await execFileAsync('node', [convertScript]);
  return JSON.parse(stdout);
}

describe('convert.mjs (ported from transformJSXToJson)', () => {
  test('Render children text', async () => {
    const { ui } = await runConvert(`<div>text</div>`);
    expect(ui).toEqual({ component: 'div', children: 'text' });
  });

  test('Render empty', async () => {
    const { ui } = await runConvert(`<div></div>`);
    expect(ui).toEqual({ component: 'div' });
  });

  test('Render closed tag', async () => {
    const { ui } = await runConvert(`<div />`);
    expect(ui).toEqual({ component: 'div' });
  });

  test('Render boolean prop', async () => {
    const { ui } = await runConvert(`<div bool={true}>check true</div>`);
    expect(ui).toEqual({ component: 'div', props: { bool: true }, children: 'check true' });
  });

  test('Render boolean prop short', async () => {
    const { ui } = await runConvert(`<div bool>check true</div>`);
    expect(ui).toEqual({ component: 'div', props: { bool: true }, children: 'check true' });
  });

  test('Render string prop', async () => {
    const { ui } = await runConvert(`<div str="str">check str</div>`);
    expect(ui).toEqual({ component: 'div', props: { str: 'str' }, children: 'check str' });
  });

  test('Render string prop exp', async () => {
    const { ui } = await runConvert(`<div str={"str"}>check str</div>`);
    expect(ui).toEqual({ component: 'div', props: { str: 'str' }, children: 'check str' });
  });

  test('Render int prop', async () => {
    const { ui } = await runConvert(`<div int={1}>check int</div>`);
    expect(ui).toEqual({ component: 'div', props: { int: 1 }, children: 'check int' });
  });

  test('Render float prop', async () => {
    const { ui } = await runConvert(`<div float={1.2}>check float</div>`);
    expect(ui).toEqual({ component: 'div', props: { float: 1.2 }, children: 'check float' });
  });

  test('Render null prop', async () => {
    const { ui } = await runConvert(`<div nil={null}>check null</div>`);
    expect(ui).toEqual({ component: 'div', props: { nil: null }, children: 'check null' });
  });

  test('Render undefined prop becomes null', async () => {
    const { ui } = await runConvert(`<div nil={undefined}>check null</div>`);
    expect(ui).toEqual({ component: 'div', props: { nil: null }, children: 'check null' });
  });

  test('Render object prop', async () => {
    const { ui } = await runConvert(`<div css={{display: 'flex'}}>check css</div>`);
    expect(ui).toEqual({ component: 'div', props: { css: { display: 'flex' } }, children: 'check css' });
  });

  test('Render deep object prop', async () => {
    const jsx = `<div css={{display: 'flex', "& .kek": {color: "red", display: [1, 2, {border: "solid 1px red"}]}}}>check css</div>`;
    const { ui } = await runConvert(jsx);
    expect(ui).toEqual({
      component: 'div',
      props: {
        css: {
          display: 'flex',
          '& .kek': { color: 'red', display: [1, 2, { border: 'solid 1px red' }] },
        },
      },
      children: 'check css',
    });
  });

  test('Render list prop', async () => {
    const { ui } = await runConvert(`<div list={[1,2,3]}>check arr</div>`);
    expect(ui).toEqual({ component: 'div', props: { list: [1, 2, 3] }, children: 'check arr' });
  });

  test('Render node element prop', async () => {
    const { ui } = await runConvert(`<div render={<span>123</span>} />`);
    expect(ui).toEqual({ component: 'div', props: { render: { component: 'span', children: '123' } } });
  });

  test('Render node element list prop', async () => {
    const { ui } = await runConvert(`<div render={[<span>123</span>, <span>321</span>]} />`);
    expect(ui).toEqual({
      component: 'div',
      props: { render: [ { component: 'span', children: '123' }, { component: 'span', children: '321' } ] },
    });
  });

  test('Render node element list prop #2', async () => {
    const { ui } = await runConvert(`<div render={<div><div>123</div><div>321</div></div>} />`);
    expect(ui).toEqual({
      component: 'div',
      props: { render: { component: 'div', children: [ { component: 'div', children: '123' }, { component: 'div', children: '321' } ] } },
    });
  });

  test('Render spaces', async () => {
    const jsx = `
      <div>
          <span>
              text
          </span>
      </div>
    `;
    const { ui } = await runConvert(jsx);
    expect(ui).toEqual({ component: 'div', children: { component: 'span', children: 'text' } });
  });

  test('Render space after symbol', async () => {
    const jsx = `
      <div>
          <span>
              {", "}
          </span>
      </div>
    `;
    const { ui } = await runConvert(jsx);
    expect(ui).toEqual({ component: 'div', children: { component: 'span', children: ', ' } });
  });

  test('Render space before symbol', async () => {
    const jsx = `
      <div>
          <span>
              {" ,"}
          </span>
      </div>
    `;
    const { ui } = await runConvert(jsx);
    expect(ui).toEqual({ component: 'div', children: { component: 'span', children: ' ,' } });
  });

  test('Render trim string symbol', async () => {
    const jsx = `
      <div>
          <span>
          Hello
              {" ,"}
              World
          </span>
      </div>
    `;
    const { ui } = await runConvert(jsx);
    expect(ui).toEqual({ component: 'div', children: { component: 'span', children: ['Hello', ' ,', 'World'] } });
  });

  test('Render export default', async () => {
    const extra = `import {Table} from '@uikit/components';`;
    const jsx = `(
      <div>
          <Table>Component</Table>
      </div>
    )`;
    const { ui } = await runConvert(jsx, extra);
    expect(ui).toEqual({ component: 'div', children: { component: 'Table', children: 'Component' } });
  });

  test('Render array children of elements', async () => {
    const { ui } = await runConvert(`<div>{[<span>kek</span>]}</div>`);
    expect(ui).toEqual({ component: 'div', children: [ { component: 'span', children: 'kek' } ] });
  });

  test('Render props array children of elements', async () => {
    const jsx = `
      <div
        content={{
          someKey: [
            <span>kek</span>,
            {
              component: 'RowKit',
              props: { preset: 'onlyPaddingTop' },
              children: 'kek',
            },
          ],
        }}
      >
        Kek
      </div>`;
    const { ui } = await runConvert(jsx);
    expect(ui).toEqual({
      component: 'div',
      props: {
        content: {
          someKey: [
            { component: 'span', children: 'kek' },
            { component: 'RowKit', props: { preset: 'onlyPaddingTop' }, children: 'kek' },
          ],
        },
      },
      children: 'Kek',
    });
  });

  test('Primitive children: number included, falsy ignored', async () => {
    const { ui } = await runConvert(`<div>{1}{false}{null}{undefined}</div>`);
    expect(ui).toEqual({ component: 'div', children: 1 });
  });

  test('Object as child', async () => {
    const { ui } = await runConvert(`<div>{{ a: 1 }}</div>`);
    expect(ui).toEqual({ component: 'div', children: { a: 1 } });
  });

  test('Array child with mixed types', async () => {
    const { ui } = await runConvert(`<div>{['a', <span/>, 1]}</div>`);
    expect(ui).toEqual({ component: 'div', children: ['a', { component: 'span' }, 1] });
  });

  test('Boolean false prop', async () => {
    const { ui } = await runConvert(`<div bool={false} />`);
    expect(ui).toEqual({ component: 'div', props: { bool: false } });
  });

  test('Empty array and object props', async () => {
    const { ui } = await runConvert(`<div list={[]} obj={{}} />`);
    expect(ui).toEqual({ component: 'div', props: { list: [], obj: {} } });
  });

  test('Filter undefined in object props; keep in arrays (nullified)', async () => {
    const { ui } = await runConvert(`<div obj={{ a: 1, b: undefined }} arr={[1, undefined, 2]} />`);
    expect(ui).toEqual({ component: 'div', props: { obj: { a: 1 }, arr: [1, null, 2] } });
  });

  test('Dashed, aria and data attributes', async () => {
    const { ui } = await runConvert(`<div data-id="1" aria-label="lab" custom-prop="x" />`);
    expect(ui).toEqual({ component: 'div', props: { 'data-id': '1', 'aria-label': 'lab', 'custom-prop': 'x' } });
  });

  test('Unicode and emoji in props and children', async () => {
    const { ui } = await runConvert(`<div title="Привет 🌍">🙂</div>`);
    expect(ui).toEqual({ component: 'div', props: { title: 'Привет 🌍' }, children: '🙂' });
  });

  test('Nested arrays as children', async () => {
    const { ui } = await runConvert(`<div>{[[<span/>]]}</div>`);
    expect(ui).toEqual({ component: 'div', children: [ { component: 'span' } ] });
  });

  test('JSX comments are ignored', async () => {
    const jsx = `
      <div>
        {/* comment */}
        <span>a</span>
      </div>
    `;
    const { ui } = await runConvert(jsx);
    expect(ui).toEqual({ component: 'div', children: { component: 'span', children: 'a' } });
  });

  test('Empty string prop via expression', async () => {
    const { ui } = await runConvert(`<div str={''} />`);
    expect(ui).toEqual({ component: 'div', props: { str: '' } });
  });

  test('Named JSX export as block', async () => {
    const extra = `export const block = <div>block</div>;`;
    const { ui, block } = await runConvert(`<div>ui</div>`, extra);
    expect(ui).toEqual({ component: 'div', children: 'ui' });
    expect(block).toEqual({ component: 'div', children: 'block' });
  });
});
