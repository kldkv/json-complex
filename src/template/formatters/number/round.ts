import { FormatterFn } from '../../types';
import { roundTo, ceilTo, floorTo, toInteger } from '../../utils/number';

/**
 * Округляет число с заданной точностью и методом.
 *
 * @param value Число или строка с числом.
 * @param precision Количество знаков после запятой.
 * @param method Способ: 'common' | 'ceil' | 'floor'.
 * @example
 * round(1.2345, '2') // 1.23
 * round(1.2345, '2', 'ceil') // 1.24
 */
export const round: FormatterFn = (
  value: any,
  precision: string = '0',
  method: string = 'common',
) => {
  if (typeof value !== 'number') {
    const num = Number(value);
    if (isNaN(num)) return value;
    value = num;
  }
  const prec = toInteger(precision) || 0;
  switch (method) {
    case 'ceil':
      return ceilTo(value, prec);
    case 'floor':
      return floorTo(value, prec);
    case 'common':
    default:
      return roundTo(value, prec);
  }
};
