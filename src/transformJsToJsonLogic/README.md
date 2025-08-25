# transformJsToJsonLogic

Библиотека для преобразования JavaScript выражений в JSON Logic формат.

## Основные возможности

- Преобразование логических и бинарных выражений (`&&`, `||`, `==`, `!=`, etc.)
- Поддержка условных выражений (тернарный оператор)
- Работа с массивами и объектами
- Опциональный chaining (`?.`)
- Nullish coalescing (`??`)
- Шаблонные литералы
- Доступ к свойствам объектов

## Пример использования

```javascript
import { transformJsToJsonLogic } from './transformJsToJsonLogic.js';

// Преобразование простого выражения
const result = transformJsToJsonLogic('a > 5 && b < 10');
console.log(result); // { "and": [{"var": "a"}, {">": [{"var": "b"}, 10]}] }

// Преобразование условного выражения
const conditional = transformJsToJsonLogic('x ? "yes" : "no"');
console.log(conditional); // {"if": [{"var": "x"}, "yes", "no"]}
```

## Ограничения

Не поддерживает:

- Циклы (for, while)
- Классы и функции
- Объявления переменных
- Присваивания
- Update expressions (++, --)

## API

### `transformJsToJsonLogic(code: string)`

Принимает строку JavaScript кода и возвращает эквивалентное JSON Logic выражение.

**Параметры:**

- `code` (string) - JavaScript выражение для преобразования

**Возвращает:**

- JSON Logic объект или выбрасывает ошибку при недопустимом синтаксисе
