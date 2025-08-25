import { FormatterFn } from '../../types';
import { toStringSafe } from '../../utils/string';

/**
 * Преобразует строку в верхний регистр (locale-agnostic).
 *
 * @param value Значение, приводится к строке.
 * @example
 * upper('Привет') // 'ПРИВЕТ'
 */
export const upper: FormatterFn = (value: any) => {
  return toStringSafe(value).toUpperCase();
};
