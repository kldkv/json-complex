import { FormatterFn } from '../../types';

/**
 * Возвращает строку: если значение «пустое» (null, undefined, '' или NaN),
 * подставляет defaultValue.
 *
 * @param value Исходное значение.
 * @param defaultValue Значение по умолчанию (строка).
 * @example
 * defaultFormatter(undefined, '—') // '—'
 * defaultFormatter(10, '—') // '10'
 */
export const defaultFormatter: FormatterFn = (
  value: any,
  defaultValue: string = '',
) => {
  const isEmpty =
    value == null ||
    value === '' ||
    (typeof value === 'number' && Number.isNaN(value));
  const normalized = isEmpty ? undefined : value;
  return String(normalized ?? defaultValue);
};
