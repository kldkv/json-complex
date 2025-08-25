import { FormatterFn } from '../../types';
import * as R from 'remeda';

/**
 * Объединяет элементы массива или значения объекта в строку с разделителем.
 * null/undefined приводятся к пустой строке.
 *
 * @param value Массив или объект.
 * @param separator Разделитель (по умолчанию пустая строка).
 * @example
 * join([1, null, 2], ' / ') // '1 /  / 2'
 * join({a: 1, b: 2}, ',') // '1,2'
 */
export const join: FormatterFn = (value: any, separator: string = '') => {
  if (Array.isArray(value)) {
    return R.pipe(
      value as unknown[],
      R.map((v) => (v == null ? '' : String(v))),
      (arr) => arr.join(separator),
    );
  }
  if (value != null && typeof value === 'object') {
    return R.pipe(
      Object.values(value as Record<string, unknown>),
      R.map((v) => (v == null ? '' : String(v))),
      (arr) => arr.join(separator),
    );
  }
  return value;
};
