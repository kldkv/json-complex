import { FormatterFn } from '../../types';
import { toInteger } from '../../utils/number';

/**
 * Возвращает первые n элементов массива. При неверном n — возвращает пустой массив.
 *
 * @param value Массив.
 * @param n Количество элементов для выборки.
 * @example
 * take([1,2,3,4], 2) // [1,2]
 */
export const take: FormatterFn = (value: any, n: number | string = 0) => {
  if (!Array.isArray(value)) return value;
  const count = toInteger(n);
  if (!Number.isFinite(count) || count <= 0) return [];
  return value.slice(0, count);
};
