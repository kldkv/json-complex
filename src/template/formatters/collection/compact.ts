import { FormatterFn } from '../../types';
/**
 * Убирает значения null, undefined и пустую строку из массива.
 *
 * @param value Входное значение. Если это не массив, возвращается как есть.
 * @returns Новый массив без «пустых» значений.
 * @example
 * compact([1, null, '', 2, undefined]) // [1, 2]
 */
export const compact: FormatterFn = (value: any) => {
  if (!Array.isArray(value)) return value;
  return (value as any[]).filter(
    (v) => v !== null && v !== undefined && v !== '',
  );
};
