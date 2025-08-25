import { describe, expect, test } from 'vitest';
import mustache from 'mustache';
import { createTemplate } from './lib';
import { PRESETS as DATE_TIME_PRESETS } from './utils/datePresets';
import { PRESETS as NUMBER_PRESETS } from './utils/numberPresets';
import { PRESETS as PERCENT_PRESETS } from './utils/percentPresets';
import { PRESETS as CURRENCY_PRESETS } from './utils/currencyPresets';
import * as F from './formatters';
import { formatDateTime as formatDateTimeFactory } from './formatters/i18n/formatDateTime';
import { formatNumber as formatNumberFactory } from './formatters/i18n/formatNumber';
import { formatCurrency as formatCurrencyFactory } from './formatters/i18n/formatCurrency';
import { formatPercent as formatPercentFactory } from './formatters/i18n/formatPercent';
import { plural as pluralFormatter } from './formatters/i18n/plural';
import { reverse as reverseFormatter } from './formatters/collection/reverse';
import { upper as upperFormatter } from './formatters/string/upper';
import { defaultFormatter as defaultFormatterFn } from './formatters/utils/default';

// Сборка реестра: маппим defaultFormatter на ключ "default", остальное как есть
const registry = { ...F, default: (F as any).defaultFormatter } as Record<
  string,
  any
>;
delete (registry as any).defaultFormatter;

const _template = createTemplate({
  ...registry,
  if: (F as any).logicIf,
  switch: (F as any).logicSwitch,
  formatDateTime: formatDateTimeFactory(DATE_TIME_PRESETS) as any,
  formatNumber: formatNumberFactory(NUMBER_PRESETS) as any,
  formatCurrency: formatCurrencyFactory(CURRENCY_PRESETS) as any,
  formatPercent: formatPercentFactory(PERCENT_PRESETS) as any,
});

const render = (tpl: string, data: unknown) => _template(tpl, data);

describe('Шаблонизатор', () => {
  describe('Базовые подстановки', () => {
    test.each([
      ['Привет, {{name}}!', { name: 'Имя' }],
      [
        'Привет, {{user.name.fullName}}!',
        { user: { name: { fullName: 'Имя' } } },
      ],
      [
        'Привет, {{users.0.name.fullName}}!',
        { users: [{ name: { fullName: 'Имя' } }] },
      ],
      [
        'Привет, {{user.name.fullName}}! Как дела, {{user.name.lastName}}?',
        { user: { name: { fullName: 'Имя', lastName: 'Фамилия' } } },
      ],
    ])('%s', (template, data) => {
      expect(render(template, data)).toBe(
        mustache.render(template, data as any),
      );
    });

    test('заменяет несколько вхождений в строке', () => {
      const [template, data] = [
        'Привет, {{user.name.fullName}}! Как дела, {{user.name.fullName}}?',
        { user: { name: { fullName: 'Имя' } } },
      ];
      expect(render(template, data)).toBe(
        mustache.render(template, data as any),
      );
    });

    test.each([
      ['{{isAdmin}}', { isAdmin: true }, ''],
      ['{{isAdmin}}', { isAdmin: false }, ''],
    ])('булевые не вставляются напрямую: %s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });
  });

  describe('Эскейпинг HTML и безопасная вставка', () => {
    test.each([
      [
        `Привет, {{user}}! <script>console.log("hello")</script>`,
        { user: 'admin' },
        'Привет, admin! &lt;script&gt;console.log(&quot;hello&quot;)&lt;/script&gt;',
      ],
      [
        `Привет, {{user}}! 🐓️️️️️️ <script>console.log("🐓️️️️️️")</script>`,
        { user: 'admin' },
        'Привет, admin! 🐓️️️️️️ &lt;script&gt;console.log(&quot;🐓️️️️️️&quot;)&lt;/script&gt;',
      ],
      [
        'Привет, {{user}}! {{bad}}',
        { user: 'admin', bad: '<script>console.log("hello")</script>' },
        'Привет, admin! &lt;script&gt;console.log(&quot;hello&quot;)&lt;/script&gt;',
      ],
      [
        'X {{val}} X',
        { val: '\'"/\\`<>&' },
        'X &#39;&quot;/\\`&lt;&gt;&amp; X',
      ],
      [
        '{{val}}',
        { val: '<img src=x onerror=alert(1)>' },
        '&lt;img src=x onerror=alert(1)&gt;',
      ],
      [
        '{{val}}',
        { val: '<ScRiPt>alert(1)</ScRiPt>' },
        '&lt;ScRiPt&gt;alert(1)&lt;/ScRiPt&gt;',
      ],
      ['{{v}}', { v: '</script>' }, '&lt;/script&gt;'],
      ['{{v}}', { v: '\u0000<script>' }, '\u0000&lt;script&gt;'],
      ['X {{val}} Y', { val: '}} {{evil}} {{' }, 'X }} {{evil}} {{ Y'],
    ])('%s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });

    test('экранированные фигурные скобки выводятся как текст', () => {
      expect(render('A \\\{{x}} B', { x: 'Y' })).toBe('A {{x}} B');
      expect(render('A {{x}} \\\}} B', { x: 'Y' })).toBe('A Y }} B');
    });

    test('незакрытый маркер не ломает парсер', () => {
      expect(render('X {{a Y', { a: 1 })).toBe('X {{a Y');
    });
  });

  describe('Строковые и числовые форматтеры (параметризовано)', () => {
    test.each([
      ['{{text+>truncate[5]}}', { text: 'Привет' }, 'Прив…'],
      ["{{text+>truncate[4, '...']}}", { text: 'abcdef' }, 'a...'],
      ['{{text+>truncate[10]}}', { text: 'hi' }, 'hi'],
    ])('truncate: %s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });

    test.each([
      ["{{v+>padStart[5, '0']}}", { v: 42 }, '00042'],
      ["{{v+>padEnd[5, '.']}}", { v: 'ab' }, 'ab...'],
      ['{{v+>padStart[4]}}', { v: 7 }, '0007'],
      ['{{v+>padEnd[4]}}', { v: 'ab' }, 'ab  '],
    ])('pad: %s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });

    test.each([
      ['{{v+>formatPercent}}', { v: 0.1234 }, '12%'],
      ['{{v+>formatPercent[2]}}', { v: 0.1234 }, '12,34%'],
      ['{{v+>formatPercent[2, "en-US"]}}', { v: 0.1234 }, '12.34%'],
    ])('formatPercent: %s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });

    test.each([
      ['{{v+>clamp[0, 100]}}', { v: -5 }, '0'],
      ['{{v+>clamp[0, 100]}}', { v: 120 }, '100'],
      ['{{v+>clamp[0, 100]}}', { v: 50 }, '50'],
      ['{{v+>clamp[0, 100]}}', { v: 'abc' }, 'abc'],
    ])('clamp: %s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });

    test.each([
      ['{{v+>abs}}', { v: -5 }, '5'],
      ['{{v+>abs}}', { v: 5 }, '5'],
      ['{{v+>abs}}', { v: '-10.5' }, '10.5'],
      ['{{v+>abs}}', { v: {} }, ''],
    ])('abs: %s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });

    test.each([
      [
        '{{date+>formatDateTime}}',
        { date: new Date('2023-12-25T14:30:00') },
        '25.12.2023, 14:30:00',
      ],
      [
        '{{date+>formatDateTime["date"]}}',
        { date: new Date('2023-12-25T14:30:00') },
        '25.12.2023',
      ],
      [
        '{{date+>formatDateTime["time"]}}',
        { date: new Date('2023-12-25T14:30:00') },
        '14:30:00',
      ],
      [
        '{{date+>formatDateTime[{"year": "numeric", "month": "2-digit"}]}}',
        { date: new Date('2023-12-25T14:30:00') },
        '12.2023',
      ],
      [
        '{{date+>formatDateTime["date", "en-US"]}}',
        { date: new Date('2023-12-25T14:30:00') },
        '12/25/2023',
      ],
      [
        '{{date+>formatDateTime["date"]}}',
        { date: '2023-12-25T14:30:00Z' },
        '25.12.2023',
      ],
    ])('formatDateTime: %s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });

    test.each([
      ['{{v+>formatNumber}}', { v: 1234.5 }, '1 235'],
      ['{{v+>formatNumber}}', { v: {} }, ''],
      ['{{v+>formatNumber[2, 2]}}', { v: 1234.567 }, '1 234,57'],
      ['{{v+>formatNumber[2, 2, "en-US"]}}', { v: 1234.567 }, '1,234.57'],
    ])('formatNumber: %s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });

    describe('formatCurrency', () => {
      test.each([
        ['{{v+>formatCurrency}}', { v: 1234.56 }, '1 234,56 ₽'],
        ['{{v+>formatCurrency["USD"]}}', { v: 1234.56 }, '1 234,56 $'],
      ])('%s', (tpl, data, expected) => {
        expect(render(tpl, data)).toBe(expected);
      });

      test.each([
        [
          'У вас {{v+>formatCurrency}} денег.',
          { v: 1255 },
          'У вас 1 255 ₽ денег.',
        ],
        [
          'У вас {{v+>formatCurrency["USD"]+>framing["+", "+"]}} денег.',
          { v: 1255 },
          'У вас +1 255 $+ денег.',
        ],
      ])('цепочки: %s', (tpl, data, expected) => {
        expect(render(tpl, data)).toBe(expected);
      });
    });

    test.each([
      ['{{v+>round}}', { v: 1.567 }, '2'],
      ['{{v+>round[2]}}', { v: 1.567 }, '1.57'],
      ['{{v+>round[0, "ceil"]}}', { v: 1.1 }, '2'],
      ['{{v+>round[0, "floor"]}}', { v: 1.9 }, '1'],
    ])('round: %s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });

    test.each([
      ['{{text+>capitalize}}', { text: 'hello world' }, 'Hello world'],
      ['{{text+>lower}}', { text: 'HELLO WORLD' }, 'hello world'],
      [
        '{{text+>title}}',
        { text: 'hello   world\t\ttest' },
        'Hello World Test',
      ],
      ["{{name+>framing['[', ']']}}", { name: 'Имя' }, '[Имя]'],
      ['{{text+>trim}}', { text: '  hello world  ' }, 'hello world'],
      [
        "{{text+>trim['', 'left']}}",
        { text: '  hello world  ' },
        'hello world  ',
      ],
      [
        "{{text+>trim['.', 'both']}}",
        { text: '..hello world..' },
        'hello world',
      ],
      ["{{name+>upper+>framing['(', ')']}}", { name: 'alex' }, '(ALEX)'],
    ])('string ops: %s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });

    test.each([
      ['{{value+>default["fallback"]}}', { value: null }, 'fallback'],
      ['{{value+>default["fallback"]}}', { value: '' }, 'fallback'],
      ['{{value+>default["fallback"]}}', { value: 'test' }, 'test'],
      ['{{value+>default["fallback"]}}', { value: 2 }, '2'],
      ['{{value+>default["fallback"]}}', { value: NaN }, 'fallback'],
    ])('default: %s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });
  });

  describe('Плюрализация', () => {
    test.each([
      [
        'Привет, {{user}}! У меня {{apple.count+>plural["яблоко","яблока","яблок"]}}',
        { user: 'admin', apple: { count: 1 } },
        'Привет, admin! У меня 1 яблоко',
      ],
      [
        'Привет, {{user}}! У меня {{apple.count+>plural["яблоко","яблока","яблок"]}}',
        { user: 'admin', apple: { count: 2 } },
        'Привет, admin! У меня 2 яблока',
      ],
      [
        'Привет, {{user}}! У меня {{apple.count+>plural["яблоко","яблока","яблок"]}}',
        { user: 'admin', apple: { count: 5 } },
        'Привет, admin! У меня 5 яблок',
      ],
      [
        'Привет, {{user}}! У меня {{apple.count+>plural["яблоко","яблока","яблок","нет яблок"]}}',
        { user: 'admin', apple: { count: null } },
        'Привет, admin! У меня нет яблок',
      ],
    ])('%s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });

    test.each([
      ['{{isAdmin+>if["Да","Нет"]}}', { isAdmin: true }, 'Да'],
      ['{{isAdmin+>if["Да","Нет"]}}', { isAdmin: false }, 'Нет'],
      ['{{v+>if["Y","N"]}}', { v: 1 }, 'Y'],
      ['{{v+>if["Y","N"]}}', { v: 0 }, 'N'],
      ['{{v+>if["Y","N"]}}', { v: 'abc' }, 'Y'],
      ['{{v+>if["Y","N"]}}', { v: '' }, 'N'],
      ['{{v+>if["Y","N"]}}', { v: NaN }, 'N'],
    ])('if: %s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });

    test('switch', () => {
      const t =
        "{{status+>switch[[ 'new','Новый' ],[ 'processing','В работе' ],[ 'default','-' ]]}}";
      expect(render(t, { status: 'new' })).toBe('Новый');
      expect(render(t, { status: 'processing' })).toBe('В работе');
      expect(render(t, { status: 'done' })).toBe('-');
      expect(render(t, { status: NaN })).toBe('-');
    });
  });

  describe('Коллекции', () => {
    test.each([
      [
        "{{items+>pluck['name']+>join[', ']}}",
        { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] },
        'a, b, c',
      ],
      ["{{items+>take[2]+>join['|']}}", { items: ['a', 'b', 'c'] }, 'a|b'],
      [
        "{{items+>slice[1, 3]+>join['-']}}",
        { items: ['x', 'y', 'z', 'w'] },
        'y-z',
      ],
      [
        "{{items+>unique+>join[',']}}",
        { items: ['a', 'b', 'a', 'c', 'b'] },
        'a,b,c',
      ],
      [
        "{{items+>unique['id']+>pluck['name']+>join[', ']}}",
        {
          items: [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' },
            { id: 1, name: 'A2' },
          ],
        },
        'A, B',
      ],
      [
        "{{items+>sortBy['age','asc']+>pluck['name']+>join[',']}}",
        {
          items: [
            { name: 'Bob', age: 30 },
            { name: 'Ann', age: 25 },
            { name: 'Cid', age: 30 },
          ],
        },
        'Ann,Bob,Cid',
      ],
      [
        "{{items+>sortBy['age','desc']+>pluck['name']+>join[',']}}",
        {
          items: [
            { name: 'Bob', age: 30 },
            { name: 'Ann', age: 25 },
            { name: 'Cid', age: 30 },
          ],
        },
        'Bob,Cid,Ann',
      ],
    ])('%s', (tpl, data, expected) => {
      expect(render(tpl, data)).toBe(expected);
    });

    test('filterBy + orderBy + pick/omit/compact/distinctBy', () => {
      const data = {
        items: [
          { id: 1, name: 'Ann', age: 25, city: 'MSK' },
          { id: 2, name: 'Bob', age: 30, city: '' },
          { id: 3, name: 'Cid', age: 30, city: 'SPB' },
          { id: 2, name: 'Bob2', age: 30, city: 'SPB' },
        ],
      };
      const tpl =
        "{{items+>filterBy[[ 'age','gte',26 ],[ 'city','ne','' ],'and']+>orderBy[[ 'age','desc' ],[ 'name','asc' ]]+>pick['name','city']+>compact+>distinctBy['name']+>pluck['name']+>join[', ']}}";
      const rendered = render(tpl, data);
      const parts = rendered.split(', ').filter((s) => s.length > 0);
      expect(parts).toEqual(['Bob2', 'Cid']);
    });

    test('groupBy: количество групп по ключу', () => {
      const tpl = "{{items+>groupBy['city']+>length}}";
      const data = {
        items: [
          { name: 'A', city: 'MSK' },
          { name: 'B', city: 'SPB' },
          { name: 'C', city: 'SPB' },
        ],
      };
      expect(render(tpl, data)).toBe('2');
    });
  });

  describe('Безопасность', () => {
    test.each([
      ['{{user.__proto__}}', { user: { name: 'u' } }],
      ['{{user.prototype}}', { user: { name: 'u' } }],
      ['{{user.constructor}}', { user: { name: 'u' } }],
      ['{{obj.toString}}', { obj: {} }],
      ['{{arr.__proto__.map}}', { arr: [1, 2, 3] }],
      ['{{arr.0.constructor}}', { arr: [1, 2, 3] }],
    ])('%s -> пусто', (tpl, data) => {
      expect(render(tpl, data)).toBe('');
    });

    test('не интерполирует повторно содержимое из данных', () => {
      const [template, data] = ['A {{val}} B', { val: '{{injected}}' }];
      expect(render(template, data)).toBe('A {{injected}} B');
    });

    test('вставка скобок-закрывашек не ломает парсер и не повторно интерполируется', () => {
      expect(render('X {{val}} Y', { val: '}} {{evil}} {{' })).toBe(
        'X }} {{evil}} {{ Y',
      );
    });

    test('очень длинная строка с угловыми скобками экранируется полностью', () => {
      const count = 1000;
      const val = '<'.repeat(count) + 'x' + '>'.repeat(count);
      const rendered = render('{{v}}', { v: val });
      const lefts = (rendered.match(/&lt;/g) || []).length;
      const rights = (rendered.match(/&gt;/g) || []).length;
      expect(lefts).toBe(count);
      expect(rights).toBe(count);
      expect(rendered.startsWith('&lt;')).toBe(true);
      expect(rendered.endsWith('&gt;')).toBe(true);
    });

    test('устойчив к попытке закрыть выражение в параметрах форматера', () => {
      const tpl = "X {{value+>formatNumber[2, 2, 'en-US']}} }} Y";
      expect(render(tpl, { value: 1234.567 })).toBe('X 1,234.57 }} Y');
    });

    test('игнорирует неизвестные форматтеры', () => {
      expect(render('{{value+>iDoNotExist}}', { value: 1 })).toBe('1');
    });

    test('prototype pollution: groupBy по значению "__proto__" не ломает результат', () => {
      const tpl = "{{items+>groupBy['city']+>length}}";
      const data = { items: [{ city: '__proto__' }, { city: 'safe' }] } as any;
      const rendered = render(tpl, data);
      expect(rendered).toBe('2');
      expect(({} as any).polluted).toBeUndefined();
    });
  });

  describe('Unicode-графемы', () => {
    test('reverse не ломает флаг (в зависимости от Intl.Segmenter)', () => {
      const flag = '🇷🇺';
      const rendered = render('{{v+>reverse}}', { v: flag });
      // Если доступен сегментер — ожидаем неизменность
      if ((Intl as any)?.Segmenter) {
        expect(rendered).toBe(flag);
      } else {
        expect(rendered.length > 0).toBe(true);
      }
    });

    test('length считает графемы, если доступен Intl.Segmenter', () => {
      const flag = '🇷🇺';
      const rendered = render('{{v+>length}}', { v: flag });
      if ((Intl as any)?.Segmenter) {
        expect(rendered).toBe('1');
      }
    });

    test('truncate по графемам (если есть Intl.Segmenter)', () => {
      const s = '🇷🇺🇧🇾';
      if ((Intl as any)?.Segmenter) {
        expect(render("{{v+>truncate[1,'']}}", { v: s })).toBe('🇷🇺');
      }
    });
  });

  describe('Вложенная интерполяция в аргументах форматтеров', () => {
    test('default: подстановка вложенного выражения как аргумента', () => {
      const data = { data: { name: 'Пользователь', defaultName: 'Гость' } };
      const tpl = '{{data.name+>default[{{data.defaultName}}]}}';
      expect(render(tpl, data)).toBe('Пользователь');
    });

    test('default: когда основное пусто — берет вложенный аргумент', () => {
      const data = { data: { name: '', defaultName: 'Гость' } };
      const tpl = '{{data.name+>default[{{data.defaultName}}]}}';
      expect(render(tpl, data)).toBe('Гость');
    });

    test('formatNumber: вложенный preset как строка', () => {
      const data = { value: 1234.567, preset: 'decimal2' };
      const tpl = '{{value+>formatNumber[{{preset}}]}}';
      // decimal2 preset -> минимум/максимум 2 знака
      expect(render(tpl, data)).toBe('1 234,57');
    });

    test('framing: вложенные строковые аргументы', () => {
      const data = { v: 'X', l: '<', r: '>' };
      const tpl = '{{v+>framing[{{l}}, {{r}}]}}';
      expect(render(tpl, data)).toBe('&lt;X&gt;');
    });

    test('сложное: switch со вложенными значениями', () => {
      const data = {
        status: 'processing',
        txt: { processing: 'В работе' },
      } as any;
      const tpl =
        "{{status+>switch[[ 'new','Новый' ],[ 'processing', {{txt.processing}} ],[ 'default','-' ]]}}";
      expect(render(tpl, data)).toBe('В работе');
    });

    test('безопасность: доступ к запрещённым ключам в аргументах даёт пустую строку', () => {
      const data = { v: '', user: { name: 'u' }, arr: [1, 2, 3] } as any;
      expect(render('{{v+>default[{{user.__proto__}}]}}', data)).toBe('');
      expect(render('{{v+>default[{{user.constructor}}]}}', data)).toBe('');
      expect(render('{{v+>default[{{arr.0.constructor}}]}}', data)).toBe('');
    });

    test('безопасность: инъекция скобок в подставляемое значение не ломает синтаксис', () => {
      const data = { v: '', evil: ']} }} {{ ["x"]' };
      // Значение подставляется как JSON-строка и не может "вырваться" из массива аргументов
      expect(render('{{v+>default[{{evil}}]}}', data)).toBe(
        ']} }} {{ [&quot;x&quot;]',
      );
    });

    test('безопасность: HTML в значении аргумента экранируется на финальном рендере', () => {
      const data = { v: '', html: '<img src=x onerror=alert(1)>' };
      expect(render('{{v+>default[{{html}}]}}', data)).toBe(
        '&lt;img src=x onerror=alert(1)&gt;',
      );
    });

    test('безопасность: подставленное как аргумент выражение не интерполируется повторно', () => {
      const data = { v: '', evil: '{{injected}}' };
      expect(render('{{v+>default[{{evil}}]}}', data)).toBe('{{injected}}');
    });

    test('вложенные числовые аргументы: round[{{digits}}]', () => {
      const data = { v: 1.567, digits: 2 };
      expect(render('{{v+>round[{{digits}}]}}', data)).toBe('1.57');
    });

    test('вложенные булевы аргументы: if["Y","N"] и значение по выражению', () => {
      const data1 = { v: true };
      const data2 = { v: false };
      expect(render('{{v+>if["Y","N"]}}', data1)).toBe('Y');
      expect(render('{{v+>if["Y","N"]}}', data2)).toBe('N');
    });

    test('вложение внутри строкового литерала: framing["{{l}}", "{{r}}"]', () => {
      const data = { v: 'X', l: '"', r: '"' };
      const tpl = '{{v+>framing["{{l}}", "{{r}}"]}}';
      expect(render(tpl, data)).toBe('&quot;X&quot;');
    });

    test('неизвестный форматтер внутри вложенного выражения игнорируется', () => {
      const data = { v: '', evil: 'abc' };
      expect(render('{{v+>default[{{evil+>iDoNotExist}}]}}', data)).toBe('abc');
    });

    test('безопасность: попытка закрыть строку и массив в подставляемом значении безопасна', () => {
      const data = { v: '', evil: '" ] }, { "x": 1' };
      // Вставится как одна JSON-строка, кавычки экранируются
      expect(render('{{v+>default[{{evil}}]}}', data)).toContain(
        '&quot; ] }, { &quot;x&quot;: 1',
      );
    });
  });

  describe('Конфигурация шаблонизатора', () => {
    test('defaultLocale пробрасывается в терминальные форматтеры', () => {
      const t = createTemplate(
        {
          formatNumber: formatNumberFactory(NUMBER_PRESETS) as any,
          formatCurrency: formatCurrencyFactory(CURRENCY_PRESETS) as any,
          formatPercent: formatPercentFactory(PERCENT_PRESETS) as any,
          default: defaultFormatterFn,
        },
        { defaultLocale: 'en-US' },
      );
      expect(t('{{v+>formatNumber}}', { v: 1234.5 })).toBe('1,235');
      // По умолчанию preset 'RUB' даёт префиксный знак в en-US наших пресетов
      expect(t('{{v+>formatCurrency}}', { v: 1255 })).toBe('RUB 1,255');
      expect(t('{{v+>formatPercent}}', { v: 0.1234 })).toBe('12%');
    });

    test('pluralRule переопределяется (английское правило)', () => {
      const englishRule = (n?: number | null) => (n === 1 ? 0 : 1);
      const t = createTemplate(
        {
          plural: pluralFormatter as any,
          default: defaultFormatterFn,
        },
        { pluralRule: englishRule },
      );
      expect(t("{{n+>plural['apple','apples']}}", { n: 1 })).toBe('1 apple');
      expect(t("{{n+>plural['apple','apples']}}", { n: 2 })).toBe('2 apples');
    });

    test('limits.formatterChain ограничивает длину цепочки', () => {
      const t = createTemplate(
        {
          upper: upperFormatter as any,
          reverse: reverseFormatter as any,
          default: defaultFormatterFn,
        },
        { limits: { formatterChain: 1 } as any },
      );
      expect(t('{{v+>upper+>reverse}}', { v: 'ab' })).toBe('AB');
    });

    test('varName позволяет обращаться к корню как ctx', () => {
      const t = createTemplate(
        { default: defaultFormatterFn },
        { varName: 'ctx' },
      );
      expect(t('Hi, {{ctx.user.name}}', { user: { name: 'Ann' } })).toBe(
        'Hi, Ann',
      );
    });

    test('limits.pathSegments выбрасывает ошибку при превышении', () => {
      const t = createTemplate(
        { default: defaultFormatterFn },
        {
          limits: {
            pathSegments: 1,
            formatterChain: 8,
            keyLength: 128,
            paramsLength: 4096,
          } as any,
        },
      );
      expect(() => t('{{a.b}}', { a: { b: 1 } })).toThrow();
    });
  });

  describe('random', () => {
    test('если нет данных -> целое 0..100', () => {
      const rendered = render('{{v+>random}}', {});
      const asNumber = Number(rendered);
      expect(Number.isInteger(asNumber)).toBe(true);
      expect(asNumber).toBeGreaterThanOrEqual(0);
      expect(asNumber).toBeLessThanOrEqual(100);
    });

    test('по умолчанию 0..100', () => {
      const rendered = render('{{v+>random}}', { v: 1 });
      const asNumber = Number(rendered);
      expect(Number.isInteger(asNumber)).toBe(true);
      expect(asNumber).toBeGreaterThanOrEqual(0);
      expect(asNumber).toBeLessThanOrEqual(100);
    });

    test('диапазон и плавающее 1..2 включительно', () => {
      const rendered = render('{{v+>random[1, 2, true]}}', { v: 1 });
      const asNumber = Number(rendered);
      expect(asNumber).toBeGreaterThanOrEqual(1);
      expect(asNumber).toBeLessThanOrEqual(2);
      expect(Number.isFinite(asNumber)).toBe(true);
    });

    test('фиксированный диапазон 5..5', () => {
      const rendered = render('{{v+>random[5, 5]}}', { v: 1 });
      expect(rendered).toBe('5');
    });
  });
});
