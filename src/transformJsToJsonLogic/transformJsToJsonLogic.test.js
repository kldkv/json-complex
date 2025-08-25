import { describe, it, expect } from 'vitest';
import { transformJsToJsonLogic } from './transformJsToJsonLogic';

function testOutput(inputRule, exp) {
  const result = transformJsToJsonLogic(inputRule);
  if (typeof exp === 'function') {
    return exp(result);
  }
  return expect(result).toEqual(exp);
}

function testError(inputRule, _errorMessage) {
  return expect(() => transformJsToJsonLogic(inputRule)).toThrow(Error);
}

describe('transformJsToJsonLogic', () => {
  it('parses literals', () => {
    testOutput('1', 1);
    testOutput('"a"', 'a');
    testOutput('true', true);
    testOutput('null', null);
    testOutput('/a/i', ['a', 'i']);
  });

  it('parses identifiers as vars', () => {
    testOutput('x', { var: 'x' });
    testOutput('undefined', null);
  });

  it('parses arrays and spread', () => {
    testOutput('[1,2,3]', [1, 2, 3]);
    testOutput('[1,...a,3]', { merge: [1, { var: 'a' }, 3] });
  });

  it('parses objects', () => {
    testOutput('{a:1,b:2}', { a: 1, b: 2 });
  });

  it('parses binary and logical expressions', () => {
    testOutput('1 + 2', { '+': [1, 2] });
    testOutput('a && b', { and: [{ var: 'a' }, { var: 'b' }] });
    testOutput('a || b', { or: [{ var: 'a' }, { var: 'b' }] });
    testOutput('a ?? b', { '??': [{ var: 'a' }, { var: 'b' }] });
    testOutput('maybe?.a ?? b ?? "hello"', {
      '??': [{ '??': [{ var: 'maybe.a' }, { var: 'b' }] }, 'hello'],
    });
    testOutput('(a || b) && c', {
      and: [{ or: [{ var: 'a' }, { var: 'b' }] }, { var: 'c' }],
    });
    testOutput('a || (b && c)', {
      or: [{ var: 'a' }, { and: [{ var: 'b' }, { var: 'c' }] }],
    });
    testOutput('(1 + 2) * 3', { '*': [{ '+': [1, 2] }, 3] });
    testOutput('1 + (2 * 3)', { '+': [1, { '*': [2, 3] }] });
  });

  it('parses unary expressions', () => {
    testOutput('!a', { '!': [{ var: 'a' }] });
    testOutput('!!a', { '!!': [{ var: 'a' }] });
    testOutput('-1', -1);
  });

  it('parses conditional expression', () => {
    testOutput('a?b:c', { if: [{ var: 'a' }, { var: 'b' }, { var: 'c' }] });
  });

  it('parses member expression path', () => {
    testOutput('obj.prop', { var: 'obj.prop' });
    testOutput('obj["x"]', (res) => expect(res.var).toBe('obj.x'));
    testOutput('obj?.prop', { var: 'obj.prop' });
    testOutput('obj?.["x"]', (res) => expect(res.var).toBe('obj.x'));
  });

  it('parses call expression', () => {
    testOutput('sum(1,2)', { sum: [1, 2] });
    testOutput('fn(a)', { fn: [{ var: 'a' }] });
    testOutput('maybe?.fn(a)', { 'maybe.fn': [{ var: 'a' }] });
  });

  it('parses arrow function and replaces param var with blank', () => {
    testOutput('(x)=>x', { var: '' });
    testOutput('(x)=>x+1', { '+': [{ var: '' }, 1] });
  });

  it('parses if statement', () => {
    testOutput('if(a){b}else{c}', {
      if: [{ var: 'a' }, { var: 'b' }, { var: 'c' }],
    });
  });

  it('throws on unsupported constructs', () => {
    testError('for(;;);');
    testError('class A{}');
    testError('let a=1');
  });
});

describe('transformJsToJsonLogic - groups', () => {
  it('parse string literals', () => {
    testOutput('"hi"', 'hi');
    testOutput('say("hey!")', { say: ['hey!'] });
    testOutput('blue + "hey"', { '+': [{ var: 'blue' }, 'hey'] });
    testOutput("log('hi')", { log: ['hi'] });
  });

  it('parse identifiers (variables) and nullish values', () => {
    testOutput('', null);
    testOutput('myVar', { var: 'myVar' });
    testOutput('null', null);
    testOutput('undefined', null);
  });

  it('parse member expressions', () => {
    testOutput('arr[0]', { var: 'arr.0' });
    testOutput('obj.prop', { var: 'obj.prop' });
    testOutput('deep.object.that.has.deep.properties', {
      var: 'deep.object.that.has.deep.properties',
    });
    testOutput('deep.object.that.has[0].multiple.arrays[3].in[2].it', {
      var: 'deep.object.that.has.0.multiple.arrays.3.in.2.it',
    });
    testOutput('user?.profile?.name', { var: 'user.profile.name' });
    testOutput('dict?.["k"]', (res) => expect(res.var).toBe('dict.k'));
    testOutput('object.super.deep.function()', {
      'object.super.deep.function': [],
    });
    testOutput('object.super.deep.function(plus, "args")', {
      'object.super.deep.function': [{ var: 'plus' }, 'args'],
    });
  });

  it('parse numeric literals', () => {
    testOutput('0', 0);
    testOutput('10000000', 10000000);
    testOutput('10 + 10', { '+': [10, 10] });
    testOutput('callFunction(10, 10, 20)', { callFunction: [10, 10, 20] });
  });

  it('parse regex literals', () => {
    testOutput('/word/', ['word', '']);
    testOutput('test(/^[2-9]\\d{2}-\\d{3}-\\d{4}$/gi)', {
      test: [['^[2-9]\\d{2}-\\d{3}-\\d{4}$', 'gi']],
    });
  });

  it('parse array expressions', () => {
    testOutput('[1,2,3]', [1, 2, 3]);
    testOutput(
      'filter(["banana", "strawberry", "mango"], x => x === "mango")',
      {
        filter: [
          ['banana', 'strawberry', 'mango'],
          {
            '===': [{ var: '' }, 'mango'],
          },
        ],
      },
    );
    testOutput('[a === b, c === d, e === f]', [
      { '===': [{ var: 'a' }, { var: 'b' }] },
      { '===': [{ var: 'c' }, { var: 'd' }] },
      { '===': [{ var: 'e' }, { var: 'f' }] },
    ]);
    testOutput('[1, 2, ...myArray]', {
      merge: [1, 2, { var: 'myArray' }],
    });
    testOutput('maybe?.list?.[0]', { var: 'maybe.list.0' });
  });

  it('parse object expressions and ignore spread elements', () => {
    testOutput('({ a: 1, b: 2, ...c })', {
      a: 1,
      b: 2,
    });
    testOutput('console.log({ a: 1, b: 2, c: 3 })', {
      'console.log': [
        {
          a: 1,
          b: 2,
          c: 3,
        },
      ],
    });
    testOutput('say([{ a: "1", b: 2, c }])', {
      say: [[{ a: '1', b: 2, c: { var: 'c' } }]],
    });
    testOutput('get(obj?.a?.b)', { get: [{ var: 'obj.a.b' }] });
  });

  it('parse template literals', () => {
    testOutput('`Hello, ${first_name}!`', {
      cat: ['Hello, ', { var: 'first_name' }, '!'],
    });
    testOutput('`The price is $${1}`', {
      cat: ['The price is $', 1],
    });
    testOutput('`Hello there`', 'Hello there');
    testOutput('`${hi}`', { var: 'hi' });
    testOutput('sup + `Hello, ${first_name}`', {
      '+': [
        {
          var: 'sup',
        },
        {
          cat: ['Hello, ', { var: 'first_name' }],
        },
      ],
    });
    testOutput('log(`Error: ${e.message}`)', {
      log: [
        {
          cat: [
            'Error: ',
            {
              var: 'e.message',
            },
          ],
        },
      ],
    });
  });

  it('parse arithmetic expressions', () => {
    testOutput('2 + 2', { '+': [2, 2] });
    testOutput('2 - 5', { '-': [2, 5] });
    testOutput('price + 1', { '+': [{ var: 'price' }, 1] });
    testOutput('2 * (1 - tax)', {
      '*': [
        2,
        {
          '-': [1, { var: 'tax' }],
        },
      ],
    });
    testOutput('(a || b) && c', {
      and: [{ or: [{ var: 'a' }, { var: 'b' }] }, { var: 'c' }],
    });
    testOutput('a || (b && c)', {
      or: [{ var: 'a' }, { and: [{ var: 'b' }, { var: 'c' }] }],
    });
    testOutput('(1 + 2) * 3', { '*': [{ '+': [1, 2] }, 3] });
    testOutput('1 + (2 * 3)', { '+': [1, { '*': [2, 3] }] });
  });

  it('parse logical and comparison expressions', () => {
    testOutput('myVariable === 1', { '===': [{ var: 'myVariable' }, 1] });
    testOutput('2 > 1', { '>': [2, 1] });
    testOutput('price >= 2.40', { '>=': [{ var: 'price' }, 2.4] });
    testOutput('price > wallet || price < 0', {
      or: [
        { '>': [{ var: 'price' }, { var: 'wallet' }] },
        { '<': [{ var: 'price' }, 0] },
      ],
    });
    testOutput('a === b && c === d', {
      and: [
        { '===': [{ var: 'a' }, { var: 'b' }] },
        { '===': [{ var: 'c' }, { var: 'd' }] },
      ],
    });
    testOutput('a ?? b', { '??': [{ var: 'a' }, { var: 'b' }] });
    testOutput('maybe?.a ?? b ?? "hello"', {
      '??': [{ '??': [{ var: 'maybe.a' }, { var: 'b' }] }, 'hello'],
    });
  });

  it('parse conditional (ternary) expressions', () => {
    testOutput('a ? b : c', {
      if: [{ var: 'a' }, { var: 'b' }, { var: 'c' }],
    });
    testOutput('a ? (b ? 1 : 2) : 3', {
      if: [
        { var: 'a' },
        {
          if: [{ var: 'b' }, 1, 2],
        },
        3,
      ],
    });
    testOutput('a > 0 ? "boom" : "bam"', {
      if: [{ '>': [{ var: 'a' }, 0] }, 'boom', 'bam'],
    });
  });

  it('parse if statements', () => {
    testOutput('if (a === b) { 1 } else { 4 }', {
      if: [{ '===': [{ var: 'a' }, { var: 'b' }] }, 1, 4],
    });

    testOutput('if (a > b) { "a is greater than b" }', {
      if: [{ '>': [{ var: 'a' }, { var: 'b' }] }, 'a is greater than b'],
    });
  });

  it('parse directives as strings', () => {
    testOutput('"use strict"', 'use strict');
  });

  it('parse unary expressions', () => {
    testOutput('!variable', { '!': [{ var: 'variable' }] });
    testOutput('!!variable', { '!!': [{ var: 'variable' }] });
    testOutput('a > -1', { '>': [{ var: 'a' }, -1] });
    testOutput('-1', -1);
  });

  it('parse arrow function expressions', () => {
    testOutput('x => x + 1', { '+': [{ var: '' }, 1] });
    testOutput('() => x + 1', { '+': [{ var: 'x' }, 1] });
    testOutput('(x, y) => ({ lat: x, lon: y })', {
      lat: { var: 'x' },
      lon: { var: 'y' },
    });
    testOutput(
      'reduce(arr, (current, accumulator) => { return current + accumulator })',
      {
        reduce: [
          {
            var: 'arr',
          },
          {
            '+': [{ var: 'current' }, { var: 'accumulator' }],
          },
        ],
      },
    );
    testOutput('x => y + 1', { '+': [{ var: 'y' }, 1] });
    testError(
      '(x) => { a === b; c === d ; }',
      'Only one-line arrow functions with implicit return are supported.',
    );
  });

  it('throw an error when using unsupported features', () => {
    testError(
      'a++',
      'Update expressions (x++, ++x, x--, --x, etc.) are not supported.',
    );
    testError('log`hi`', 'Tagged template expressions are not supported.');
    testError(
      'new Book()',
      'Expressions that use the `new` keyword are not supported.',
    );
    testError('class Component {}', 'Classes are not supported.');
    testError('function x () {}', 'Function declarations are not supported.');
    testError('while (a > b) {}', 'While-loops are not supported.');
    testError('for (let i; i < 10; i++) {}', 'For-loops are not supported.');
    testError('switch (rule) { }', 'Switch statements are not supported.');
    testError(
      'const x = []',
      'Variable (var, let, const) declarations are not supported.',
    );
    testError('x = 1', 'Assignments not supported.');
    testError(
      'with (a) {}',
      'Could not parse code. [1:6]: Strict mode code may not include a with statement',
    );
  });

  it('throw an error when providing a multi-expression block statement or directives', () => {
    testError(
      '{ a === b; c === d }',
      'Block statements can only have one expression statement.',
    );
    testError('a === b; b === c;', 'Only one expression statement allowed.');
    testError('"hi";"hey";', 'Only one expression statement allowed.');
  });

  it('throw an error when syntax is invalid', () => {
    testError('1 / function', "Could not parse code. [1:12]: Expected '('");
    testError(
      '99999eeee999e9e9e9',
      'Could not parse code. [1:6]: Non-number found after exponent indicator',
    );
    testError(
      '#great',
      "Private names are not supported. Unexpected character '#'",
    );
  });
});
