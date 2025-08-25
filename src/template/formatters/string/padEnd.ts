import { FormatterFn } from '../../types';
import { pad as basePad } from './pad';
/**
 * Дополняет строку справа до нужной длины.
 *
 * @param value Значение, приводится к строке.
 * @param targetLength Желаемая длина.
 * @param padString Строка-дополнитель.
 * @example
 * padEnd('7', 3, '0') // '700'
 */
export const padEnd: FormatterFn = (
  value: any,
  targetLength: number | string = 0,
  padString: string = ' ',
) => basePad(value, targetLength, padString, 'right');
