import { FormatterFn } from '../../types';
import {
  toStringSafe,
  graphemeSlice,
  graphemeLength,
} from '../../utils/string';
import { toInteger } from '../../utils/number';

/**
 * Усечёт строку по графемам до max символов и добавит суффикс.
 *
 * @param value Значение, приводится к строке.
 * @param maxLength Максимальная длина результата.
 * @param suffix Суффикс (по умолчанию '…').
 * @example
 * truncate('привет мир', 6) // 'приве…'
 */
export const truncate: FormatterFn = (
  value: any,
  maxLength: number | string = 0,
  suffix: string = '…',
) => {
  const text = toStringSafe(value ?? '');

  const len = typeof maxLength === 'number' ? maxLength : toInteger(maxLength);

  if (!Number.isFinite(len) || len <= 0) {
    return text;
  }

  if (graphemeLength(text) <= len) {
    return text;
  }

  const suffixText = suffix == null ? '' : toStringSafe(suffix);
  const sliceLen = Math.max(0, len - graphemeLength(suffixText));
  return graphemeSlice(text, 0, sliceLen) + suffixText;
};
