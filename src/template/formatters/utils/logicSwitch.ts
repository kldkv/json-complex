import { FormatterFn } from '../../types';

/**
 * Многоветвленный выбор: принимает пары [matchValue, thenValue] и опционально ['default', value].
 * Сопоставление идёт по строковому сравнению для предсказуемости.
 *
 * @example
 * logicSwitch('b', ['a', 1], ['b', 2], ['default', 0]) // 2
 */
export const logicSwitch: FormatterFn = (
  value: any,
  casesOrFirst?: any,
  ...rest: any[]
) => {
  const strVal = String(value);
  let hasDefault = false;
  let defaultValue: unknown = '';

  // Собираем пары: поддерживаем как массив пар, так и varargs из пар
  let pairs: Array<[unknown, unknown]> = [];
  if (
    Array.isArray(casesOrFirst) &&
    Array.isArray((casesOrFirst as any[])[0])
  ) {
    pairs = casesOrFirst as Array<[unknown, unknown]>;
  } else {
    const tmp = [casesOrFirst, ...rest];
    for (const p of tmp) {
      if (Array.isArray(p)) pairs.push(p as [unknown, unknown]);
    }
  }

  for (const pair of pairs) {
    if (!Array.isArray(pair)) continue;
    const [match, out] = pair as [unknown, unknown];
    if (match === 'default') {
      hasDefault = true;
      defaultValue = out;
      continue;
    }
    if (String(match) === strVal) {
      return out;
    }
  }
  return hasDefault ? defaultValue : '';
};

// алиас для удобства: switch
export const switchFormatter = logicSwitch;
