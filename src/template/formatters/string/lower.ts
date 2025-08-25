import { FormatterFn } from '../../types';
import { toStringSafe } from '../../utils/string';

/**
 * Преобразует строку в нижний регистр (locale-agnostic).
 *
 * @param value Значение, приводится к строке.
 * @example
 * lower('ПрИвЕт') // 'привет'
 */
export const lower: FormatterFn = (value: any) => {
  return toStringSafe(value).toLowerCase();
};
