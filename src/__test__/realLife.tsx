// Здесь импорт откуда не сильно важен, так как для пользователя это проверка пропсов на типы с помощью typescript (tsx)
// А для рендеринга это не имеет значения, так как главное взять название компонента и пропсы
import * as R from 'remeda';
import * as React from 'react';
import {
  getString,
  getNumber,
  getDateString,
  getArray,
  getObject,
  getBoolean,
  getNull,
  getUndefined,
} from './utils';
import { Typography } from 'antd';
// @ts-expect-error: JS module without types is fine for tests
import { transformJsToJsonLogic } from '../transformJsToJsonLogic/index.mjs';

export const name = 'realLife';
export const description = 'Real life example';

const str = 'hello';
const str2 = 'world';
const num = 2;
const boolTrue = true;
const boolFalse = false;

const reverseFalse = !boolFalse;
const ternary = boolTrue ? 'yes' : 'no';
const reveseTernary = !boolTrue ? 'yes' : 'no';

const getAriaDescription = () => `${str} and ${str2}`;
const concatString = (a: string, b: string) => `${a} ${b}`;
const getNowString = () => new Date('2025-08-25').toISOString();
const title = concatString(str, concatString(str, str2));
const ternaryNum = boolTrue ? num + 1 : num + 2;
const tmpl = `${str}${num}`;
const notTrue = !boolTrue;
const nested = concatString(concatString(str, str2), str);
const component = <div aria-hidden={boolTrue}>hello</div>;
const componentList = [<div>hello</div>, <div>{str2}</div>];
const Сomponent = () => <div aria-hidden={boolTrue}>hello</div>;
const СomponentProps = (props: { text: string }) => (
  <div aria-hidden={boolTrue}>{props.text}</div>
);

const fullComponent = (
  <div
    aria-hidden={boolTrue}
    draggable={boolFalse}
    aria-label={`${str} and ${str2}`}
  >
    <Typography>
      {str} {num}
    </Typography>
  </div>
);
const sum = R.sum([1, 2, 3]);

export const ui = <div>ui</div>;
export const notUI = <div>notUI</div>;

export const block = (
  <div
    data-logic={transformJsToJsonLogic("x ? 'yes' : 'no'")}
    data-sum={sum}
    aria-hidden={boolTrue}
    draggable={boolFalse}
    aria-label={`${str} and ${str2}`}
    aria-description={getAriaDescription()}
    role={concatString(str, str2)}
    aria-disabled={reverseFalse}
    data-checked={ternary}
    data-expanded={reveseTernary}
    aria-now={getNowString()}
    data-Component={<Сomponent />}
    data-ComponentProps={<СomponentProps text="world" />}
    aria-title={title}
    data-ternary-num={ternaryNum}
    data-template={tmpl}
    aria-not={notTrue}
    data-nested-call={nested}
    data-cond={boolTrue ? 'yes' : 'no'}
    data-string={getString()}
    data-number={getNumber()}
    data-date-str={getDateString()}
    data-array={getArray()}
    data-object={getObject()}
    data-bool={getBoolean()}
    data-null={getNull()}
    data-undef={getUndefined()}
    data-component={component}
    data-component-list={componentList}
    data-full-component={fullComponent}
  >
    {str} {num}
    <span>text</span>
  </div>
);

// Дополнительные реальные сценарии
export const listMap = (
  <ul>
    {['a', 'b'].map((x) => (
      <li>{x}</li>
    ))}
  </ul>
);

export const conditionalChildren = (
  <div>
    {boolFalse && <span>hidden</span>}
    {boolTrue && <span>shown</span>}
  </div>
);

const maybeStr = (): string | undefined => (({}) as Record<string, string>).x;
const maybeNull = (): string | null =>
  (JSON.parse('{"x":null}') as any).x as string | null;

export const nullish = <div data-x={maybeStr() ?? 'fallback'} />;

export const optional = <div data-a={(getObject() as any).c?.d ?? 'none'} />;

export const methodCall = (
  <div data-trim={'  hi  '.trim()} data-slice={str.slice(1, 3)} />
);

export const jsxMember = <Typography.Text strong>{str2}</Typography.Text>;

export const dataAccess = (
  <div data-obj-a={getObject().a} data-arr-item={[10, 20, 30][1]} />
);

export const newDateIso = (
  <time data-iso={new Date('2025-01-01').toISOString()} />
);

export const spreadIgnored = <div {...{ 'data-a': 1 }} data-b={2} />;

export const opChecks = (
  <div
    data-in={'a' in { a: 1 }}
    data-instance={new Date('2025-01-01') instanceof Date}
  />
);

export const logics = (
  <div
    data-and={boolTrue && 'Y'}
    data-or={boolFalse || 'X'}
    data-nv={maybeNull() ?? 'N'}
  />
);

export const _expected = {
  name: 'realLife',
  description: 'Real life example',
  ui: {
    component: 'div',
    children: 'ui',
  },
  notUI: {
    component: 'div',
    children: 'notUI',
  },
  block: {
    component: 'div',
    props: {
      'data-logic': {
        if: [{ var: 'x' }, 'yes', 'no'],
      },
      'data-sum': 6,
      'aria-hidden': true,
      'aria-label': 'hello and world',
      'aria-description': 'hello and world',
      'aria-disabled': true,
      'data-checked': 'yes',
      'data-expanded': 'no',
      'aria-now': '2025-08-25T00:00:00.000Z',
      'data-component': {
        component: 'div',
        props: { 'aria-hidden': true },
        children: 'hello',
      },
      role: 'hello world',
      draggable: false,
      'aria-title': 'hello hello world',
      'data-ternary-num': 3,
      'data-template': 'hello2',
      'aria-not': false,
      'data-nested-call': 'hello world hello',
      'data-cond': 'yes',
      'data-string': 'hello',
      'data-number': 1,
      'data-date-str':
        'Mon Aug 25 2025 03:00:00 GMT+0300 (Moscow Standard Time)',
      'data-array': [1, 2, 3],
      'data-object': { a: 1, b: 2 },
      'data-bool': true,
      'data-null': null,
      'data-undef': null,
      'data-Component': {
        component: 'div',
        props: { 'aria-hidden': true },
        children: 'hello',
      },
      'data-ComponentProps': {
        component: 'div',
        props: { 'aria-hidden': true },
        children: 'world',
      },
      'data-component-list': [
        { component: 'div', children: 'hello' },
        { component: 'div', children: 'world' },
      ],
      'data-full-component': {
        children: { component: 'Typography', children: ['hello', 2] },
        component: 'div',
        props: {
          'aria-hidden': true,
          'aria-label': 'hello and world',
          draggable: false,
        },
      },
    },
    children: [
      'hello',
      2,
      {
        component: 'span',
        children: 'text',
      },
    ],
  },
  listMap: {
    component: 'ul',
    children: [
      { component: 'li', children: 'a' },
      { component: 'li', children: 'b' },
    ],
  },
  conditionalChildren: {
    component: 'div',
    children: { component: 'span', children: 'shown' },
  },
  nullish: {
    component: 'div',
    props: { 'data-x': 'fallback' },
  },
  optional: {
    component: 'div',
    props: { 'data-a': 'none' },
  },
  methodCall: {
    component: 'div',
    props: { 'data-trim': 'hi', 'data-slice': 'el' },
  },
  jsxMember: {
    component: 'Typography.Text',
    props: { strong: true },
    children: 'world',
  },
  dataAccess: {
    component: 'div',
    props: { 'data-obj-a': 1, 'data-arr-item': 20 },
  },
  newDateIso: {
    component: 'time',
    props: { 'data-iso': '2025-01-01T00:00:00.000Z' },
  },
  spreadIgnored: {
    component: 'div',
    props: { 'data-b': 2 },
  },
  opChecks: {
    component: 'div',
    props: { 'data-in': true, 'data-instance': true },
  },
  logics: {
    component: 'div',
    props: { 'data-and': 'Y', 'data-or': 'X', 'data-nv': 'N' },
  },
};
