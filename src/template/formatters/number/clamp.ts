import { FormatterFn } from '../../types';
import { toStringSafe } from '../../utils/string';
import * as R from 'remeda';

/**
 * Ограничивает число в диапазоне [min, max]. Если value не число — возвращает исходное значение.
 *
 * @param value Число или строка с числом.
 * @param min Нижняя граница.
 * @param max Верхняя граница.
 * @example
 * clamp(10, 0, 5) // 5
 */
export const clamp: FormatterFn = (
  value: any,
  min: number | string = Number.NEGATIVE_INFINITY,
  max: number | string = Number.POSITIVE_INFINITY,
) => {
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return value;

  const minNum = typeof min === 'number' ? min : parseFloat(toStringSafe(min));
  const maxNum = typeof max === 'number' ? max : parseFloat(toStringSafe(max));

  return R.clamp(num, { min: minNum, max: maxNum });
};
