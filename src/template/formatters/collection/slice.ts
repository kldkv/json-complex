import { FormatterFn } from '../../types';
import { toInteger } from '../../utils/number';

/**
 * Возвращает срез массива по индексам start и end (не включая end).
 * Если вход — не массив, возвращается исходное значение.
 *
 * @param value Массив.
 * @param start Начальный индекс (по умолчанию 0).
 * @param end Конечный индекс (исключительно). Если не указан — до конца.
 * @example
 * slice([1,2,3,4], 1, 3) // [2,3]
 */
export const slice: FormatterFn = (
  value: any,
  start: number | string = 0,
  end?: number | string,
) => {
  if (!Array.isArray(value)) return value;
  const s = toInteger(start);
  const e = end === undefined ? undefined : toInteger(end);
  return value.slice(s, e as any);
};
