import { FormatterFn } from '../../types';

/**
 * Возвращает модуль числа. Невалидные значения дают пустую строку.
 *
 * @param value Число или строка с числом.
 * @example
 * abs(-3) // 3
 */
export const abs: FormatterFn = (value: any) => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return '';
  return Math.abs(num);
};
