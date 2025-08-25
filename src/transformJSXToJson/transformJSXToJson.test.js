import { test, expect, describe } from 'vitest';
import { transformJSXToJson } from './transformJSXToJson.js';

describe('transformJSXToJson', () => {
  test('Render children text', () => {
    const jsonData = {
      children: 'text',
      component: 'div',
    };

    expect(transformJSXToJson(`<div>text</div>`)).toEqual(jsonData);
  });

  test('Render empty', () => {
    const jsonData = {
      component: 'div',
    };

    expect(transformJSXToJson(`<div></div>`)).toEqual(jsonData);
  });

  test('Render closed tag', () => {
    expect(transformJSXToJson(`<div />`)).toEqual({
      component: 'div',
    });
  });

  test('Render boolean prop', () => {
    const jsonData = {
      children: 'check true',
      component: 'div',
      props: { bool: true },
    };

    expect(transformJSXToJson(`<div bool={true}>check true</div>`)).toEqual(
      jsonData,
    );
  });

  test('Render boolean prop short', () => {
    const jsonData = {
      children: 'check true',
      component: 'div',
      props: { bool: true },
    };

    expect(transformJSXToJson(`<div bool>check true</div>`)).toEqual(jsonData);
  });

  test('Render string prop', () => {
    const jsonData = {
      children: 'check str',
      component: 'div',
      props: { str: 'str' },
    };

    expect(transformJSXToJson(`<div str="str">check str</div>`)).toEqual(
      jsonData,
    );
  });

  test('Render string prop exp', () => {
    const jsonData = {
      children: 'check str',
      component: 'div',
      props: { str: 'str' },
    };

    expect(transformJSXToJson(`<div str={"str"}>check str</div>`)).toEqual(
      jsonData,
    );
  });

  test('Render int prop', () => {
    const jsonData = {
      children: 'check int',
      component: 'div',
      props: { int: 1 },
    };

    expect(transformJSXToJson(`<div int={1}>check int</div>`)).toEqual(
      jsonData,
    );
  });

  test('Render float prop', () => {
    const jsonData = {
      children: 'check float',
      component: 'div',
      props: { float: 1.2 },
    };

    expect(transformJSXToJson(`<div float={1.2}>check float</div>`)).toEqual(
      jsonData,
    );
  });

  test('Render bigint prop', () => {
    const jsonData = {
      children: 'check bigint',
      component: 'div',
      props: { bigint: '1' },
    };

    expect(transformJSXToJson(`<div bigint={1n}>check bigint</div>`)).toEqual(
      jsonData,
    );
  });

  test('Render null prop', () => {
    const jsonData = {
      children: 'check null',
      component: 'div',
      props: { nil: null },
    };

    expect(transformJSXToJson(`<div nil={null}>check null</div>`)).toEqual(
      jsonData,
    );
  });

  test('Render null prop short', () => {
    const jsonData = {
      children: 'check null',
      component: 'div',
    };

    expect(transformJSXToJson(`<div nil={undefined}>check null</div>`)).toEqual(
      jsonData,
    );
  });

  test('Render object prop', () => {
    const jsonData = {
      children: 'check css',
      component: 'div',
      props: {
        css: { display: 'flex' },
      },
    };
    expect(
      transformJSXToJson(`<div css={{display: 'flex'}}>check css</div>`),
    ).toEqual(jsonData);
  });

  test('Render deep object prop', () => {
    const jsonData = {
      children: 'check css',
      component: 'div',
      props: {
        css: {
          display: 'flex',
          '& .kek': {
            color: 'red',
            display: [1, 2, { border: 'solid 1px red' }],
          },
        },
      },
    };

    expect(
      transformJSXToJson(
        `<div css={{display: 'flex', "& .kek": {color: "red", display: [1, 2, {border: "solid 1px red"}]}}}>check css</div>`,
      ),
    ).toEqual(jsonData);
  });

  test('Render list prop', () => {
    const jsonData = {
      children: 'check arr',
      component: 'div',
      props: {
        list: [1, 2, 3],
      },
    };

    expect(transformJSXToJson(`<div list={[1,2,3]}>check arr</div>`)).toEqual(
      jsonData,
    );
  });

  test('Render node element prop', () => {
    const jsonData = {
      component: 'div',
      props: {
        render: {
          component: 'span',
          children: '123',
        },
      },
    };

    expect(transformJSXToJson(`<div render={<span>123</span>} />`)).toEqual(
      jsonData,
    );
  });

  test('Render node element list prop', () => {
    const jsonData = {
      component: 'div',
      props: {
        render: [
          {
            component: 'span',
            children: '123',
          },
          {
            component: 'span',
            children: '321',
          },
        ],
      },
    };

    expect(
      transformJSXToJson(
        `<div render={[<span>123</span>, <span>321</span>]} />`,
      ),
    ).toEqual(jsonData);
  });

  test('Render node element list prop #2', () => {
    const jsonData = {
      component: 'div',
      props: {
        render: {
          component: 'div',
          children: [
            {
              component: 'div',
              children: '123',
            },
            {
              component: 'div',
              children: '321',
            },
          ],
        },
      },
    };

    expect(
      transformJSXToJson(
        `<div render={<div><div>123</div><div>321</div></div>} />`,
      ),
    ).toEqual(jsonData);
  });

  test('Render spaces', () => {
    const jsonData = {
      children: { component: 'span', children: 'text' },
      component: 'div',
    };

    expect(
      transformJSXToJson(`
        <div>
            <span>
                text
            </span>
        </div>
      `),
    ).toEqual(jsonData);
  });

  test('Render space after symbol', () => {
    const jsonData = {
      children: { component: 'span', children: ', ' },
      component: 'div',
    };

    expect(
      transformJSXToJson(`
        <div>
            <span>
                {", "}
            </span>
        </div>
      `),
    ).toEqual(jsonData);
  });

  test('Render space before symbol', () => {
    const jsonData = {
      children: { component: 'span', children: ' ,' },
      component: 'div',
    };

    expect(
      transformJSXToJson(`
        <div>
            <span>
                {" ,"}
            </span>
        </div>
      `),
    ).toEqual(jsonData);
  });

  test('Render trim string symbol', () => {
    const jsonData = {
      children: { component: 'span', children: ['Hello', ' ,', 'World'] },
      component: 'div',
    };

    expect(
      transformJSXToJson(`
        <div>
            <span>
            Hello
                {" ,"}
                World
            </span>
        </div>
      `),
    ).toEqual(jsonData);
  });

  test('Render fragment', () => {
    const jsonData = {
      children: [
        { component: 'span', children: 'text' },
        { component: 'span', children: 'text2' },
      ],
      component: 'ReactFragment',
    };

    expect(
      transformJSXToJson(`
        <ReactFragment>
            <span>
                text
            </span>
            <span>
                text2
            </span>
        </ReactFragment>
      `),
    ).toEqual(jsonData);
  });

  test('Render export default', () => {
    expect(
      transformJSXToJson(`
         import {Table} from '@uikit/components';
  
         export default () => (
          <div>
              <Table>Component</Table>
          </div>
         )
      `),
    ).toEqual({
      children: { component: 'Table', children: 'Component' },
      component: 'div',
    });
  });

  test('Render array children of elements', () => {
    const jsonData = {
      component: 'div',
      children: [{ component: 'span', children: 'kek' }],
    };

    expect(transformJSXToJson(`<div>{[<span>kek</span>]}</div>`)).toEqual(
      jsonData,
    );
  });

  test('Render props array children of elements', () => {
    const jsonData = {
      component: 'div',
      props: {
        content: {
          someKey: [
            { component: 'span', children: 'kek' },
            {
              component: 'RowKit',
              props: {
                preset: 'onlyPaddingTop',
              },
              children: 'kek',
            },
          ],
        },
      },
      children: 'Kek',
    };

    expect(
      transformJSXToJson(`
        <div
          content={{
            someKey: [
              <span>kek</span>,
              {
                component: 'RowKit',
                props: {
                  preset: 'onlyPaddingTop',
                },
                children: 'kek',
              },
            ],
          }}
        >
          Kek
        </div>`),
    ).toEqual(jsonData);
  });

  // ===================== Missing scenarios =====================

  test('Fragment shorthand as root', () => {
    expect(
      transformJSXToJson(`
        <>
          <span>one</span>
          <span>two</span>
        </>
      `),
    ).toEqual({
      component: 'ReactFragment',
      children: [
        { component: 'span', children: 'one' },
        { component: 'span', children: 'two' },
      ],
    });
  });

  test('Component with dot name', () => {
    expect(transformJSXToJson(`<UI.Button>ok</UI.Button>`)).toEqual({
      component: 'UI.Button',
      children: 'ok',
    });
  });

  test('Namespaced component name', () => {
    expect(transformJSXToJson(`<svg:rect />`)).toEqual({
      component: 'svg:rect',
    });
  });

  test('Spread attributes should throw', () => {
    expect(() => transformJSXToJson(`<div {...props} a="b" />`)).toThrow();
  });

  test('Identifier prop value', () => {
    expect(() => transformJSXToJson(`<div v={varName} />`)).toThrow();
  });

  test('MemberExpression prop should throw', () => {
    expect(() => transformJSXToJson(`<div u={obj.foo} />`)).toThrow();
  });

  test('Primitive children: number included, falsy ignored', () => {
    expect(
      transformJSXToJson(`<div>{1}{false}{null}{undefined}</div>`),
    ).toEqual({
      component: 'div',
      children: 1,
    });
  });

  test('Primitive children: number and string included, falsy ignored', () => {
    expect(
      transformJSXToJson(`<div>{1}{false}{null}{undefined}{''}{" "}{3}</div>`),
    ).toEqual({
      component: 'div',
      children: [1, ' ', 3],
    });
  });

  test('Object as child', () => {
    expect(transformJSXToJson(`<div>{{ a: 1 }}</div>`)).toEqual({
      component: 'div',
      children: { a: 1 },
    });
  });

  test('Array child with mixed types', () => {
    expect(transformJSXToJson(`<div>{['a', <span/>, 1]}</div>`)).toEqual({
      component: 'div',
      children: ['a', { component: 'span' }, 1],
    });
  });

  test('Prop children overrides actual children: string', () => {
    expect(transformJSXToJson(`<div children="X">Y</div>`)).toEqual({
      component: 'div',
      children: 'X',
    });
  });

  test('Prop children overrides actual children: array', () => {
    expect(transformJSXToJson(`<div children={[1,2]}>Y</div>`)).toEqual({
      component: 'div',
      children: [1, 2],
    });
  });

  test('Prop children overrides actual children: node', () => {
    expect(
      transformJSXToJson(`<div children={<span>z</span>}>Y</div>`),
    ).toEqual({
      component: 'div',
      children: { component: 'span', children: 'z' },
    });
  });

  test('Boolean false prop', () => {
    expect(transformJSXToJson(`<div bool={false} />`)).toEqual({
      component: 'div',
      props: { bool: false },
    });
  });

  test('Empty array and object props', () => {
    expect(transformJSXToJson(`<div list={[]} obj={{}} />`)).toEqual({
      component: 'div',
      props: { list: [], obj: {} },
    });
  });

  test('Filter undefined in object props; keep in arrays', () => {
    expect(
      transformJSXToJson(
        `<div obj={{ a: 1, b: undefined }} arr={[1, undefined, 2]} />`,
      ),
    ).toEqual({
      component: 'div',
      props: { obj: { a: 1 }, arr: [1, undefined, 2] },
    });
  });

  test('Unsupported: function prop should throw', () => {
    expect(() => transformJSXToJson(`<div onClick={() => {}} />`)).toThrow();
  });

  test('Unsupported: call expression prop should throw', () => {
    expect(() => transformJSXToJson(`<div v={fn()} />`)).toThrow();
  });

  test('Unsupported: new expression prop should throw', () => {
    expect(() => transformJSXToJson(`<div v={new Date()} />`)).toThrow();
  });

  test('Unsupported: RegExp literal prop should throw', () => {
    expect(() => transformJSXToJson(`<div v={/re/} />`)).toThrow();
  });

  test('Dashed, aria and data attributes', () => {
    expect(
      transformJSXToJson(
        `<div data-id="1" aria-label="lab" custom-prop="x" />`,
      ),
    ).toEqual({
      component: 'div',
      props: { 'data-id': '1', 'aria-label': 'lab', 'custom-prop': 'x' },
    });
  });

  test('Unicode and emoji in props and children', () => {
    expect(transformJSXToJson(`<div title="Привет 🌍">🙂</div>`)).toEqual({
      component: 'div',
      props: { title: 'Привет 🌍' },
      children: '🙂',
    });
  });

  test('Multiple JSX roots: first element is used', () => {
    expect(transformJSXToJson(`<span>first</span><div>second</div>`)).toEqual({
      component: 'span',
      children: 'first',
    });
  });

  test('Nested arrays as children', () => {
    expect(transformJSXToJson(`<div>{[[<span/>]]}</div>`)).toEqual({
      component: 'div',
      children: [{ component: 'span' }],
    });
  });

  test('JSX comments are ignored', () => {
    expect(
      transformJSXToJson(`
        <div>
          {/* comment */}
          <span>a</span>
        </div>
      `),
    ).toEqual({
      component: 'div',
      children: { component: 'span', children: 'a' },
    });
  });

  test('Empty string prop via expression', () => {
    expect(transformJSXToJson(`<div str={''} />`)).toEqual({
      component: 'div',
      props: { str: '' },
    });
  });

  test('BigInt in arrays and objects within props', () => {
    expect(
      transformJSXToJson(`<div list={[1n, 2n]} obj={{ a: 1n }} />`),
    ).toEqual({
      component: 'div',
      props: { list: ['1', '2'], obj: { a: '1' } },
    });
  });

  test('Computed keys in object props', () => {
    expect(() =>
      transformJSXToJson(`<div obj={{ [keyName]: 1 }} />`),
    ).toThrow();
  });
});
