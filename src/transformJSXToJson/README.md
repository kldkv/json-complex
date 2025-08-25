# transformJSXToJson

Библиотека для преобразования JSX синтаксиса в JSON формат.

## Основные возможности

- Преобразование JSX элементов в JSON объекты
- Поддержка всех типов свойств (boolean, string, number, object, array, null, undefined)
- Работа с вложенными компонентами и фрагментами
- Обработка текстового содержимого и смешанных детей
- Поддержка специальных атрибутов (data-_, aria-_, custom props)
- Unicode и emoji поддержка
- Игнорирование JSX комментариев

## Пример использования

```javascript
import { transformJSXToJson } from './transformJSXToJson.js';

// Преобразование простого компонента
const result = transformJSXToJson('<div>Hello World</div>');
console.log(result);
// { component: 'div', children: 'Hello World' }

// Компонент со свойствами
const withProps = transformJSXToJson(
  '<div className="container" disabled={true}>Content</div>',
);
console.log(withProps);
// {
//   component: 'div',
//   props: { className: 'container', disabled: true },
//   children: 'Content'
// }

// Вложенные компоненты
const nested = transformJSXToJson(`
  <div>
    <span>Text</span>
    <Component prop={value} />
  </div>
`);
console.log(nested);
// {
//   component: 'div',
//   children: [
//     { component: 'span', children: 'Text' },
//     { component: 'Component', props: { prop: 'value' } }
//   ]
// }
```

## Поддерживаемые типы свойств

- **Boolean**: `<div bool={true} />` или `<div bool />`
- **String**: `<div str="value" />` или `<div str={"value"} />`
- **Number**: `<div num={42} />`
- **Float**: `<div float={3.14} />`
- **BigInt**: `<div big={123n} />` (преобразуется в строку)
- **Null**: `<div nil={null} />`
- **Object**: `<div obj={{key: 'value'}} />`
- **Array**: `<div arr={[1, 2, 3]} />`
- **JSX элементы**: `<div child={<span>text</span>} />`

## Особенности

### Дети компонентов

- Текстовое содержимое сохраняется как есть
- JSX элементы преобразуются в объекты с полями `component`, `props`, `children`
- Массивы детей объединяются в массивы
- Falsy значения (false, null, undefined) игнорируются, кроме чисел и строк

### Фрагменты

```javascript
// React.Fragment
<React.Fragment>
  <span>one</span>
  <span>two</span>
</React.Fragment>

// Короткая запись <>
<>
  <span>one</span>
  <span>two</span>
</>
```

Оба варианта преобразуются в:

```json
{
  "component": "ReactFragment",
  "children": [
    { "component": "span", "children": "one" },
    { "component": "span", "children": "two" }
  ]
}
```

### Специальные атрибуты

Поддерживаются dashed атрибуты, aria- и data-атрибуты:

```javascript
transformJSXToJson('<div data-id="1" aria-label="test" custom-prop="x" />');
// Результат: { component: 'div', props: { 'data-id': '1', 'aria-label': 'test', 'custom-prop': 'x' } }
```

## Ограничения

Не поддерживает:

- Spread attributes (`<div {...props} />`)
- Идентификаторы в свойствах (`<div v={variable} />`)
- Member expressions (`<div u={obj.prop} />`)
- Функции в свойствах (`<div onClick={() => {}} />`)
- Call expressions (`<div v={fn()} />`)
- New expressions (`<div v={new Date()} />`)
- RegExp литералы (`<div v={/regex/} />`)
- Computed keys в объектах (`<div obj={{ [key]: value }} />`)

## API

### `transformJSXToJson(jsxString: string)`

Принимает строку с JSX кодом и возвращает эквивалентный JSON объект.

**Параметры:**

- `jsxString` (string) - JSX код для преобразования

**Возвращает:**

- JSON объект с полями `component`, `props` (опционально), `children` (опционально)
- Выбрасывает ошибку при неподдерживаемых конструкциях

**Структура результата:**

```typescript
{
  component: string,        // Имя компонента
  props?: Record<string, any>, // Свойства компонента
  children?: any            // Дети компонента (string | object | array)
}
```
