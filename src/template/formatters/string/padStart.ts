import { FormatterFn } from '../../types';
import { pad as basePad } from './pad';

/**
 * Дополняет строку слева до нужной длины.
 *
 * @param value Значение, приводится к строке.
 * @param targetLength Желаемая длина.
 * @param padString Строка-дополнитель (по умолчанию '0').
 * @example
 * padStart('7', 3, '0') // '007'
 */
export const padStart: FormatterFn = (
  value: any,
  targetLength: number | string = 0,
  padString: string = '0',
) => basePad(value, targetLength, padString, 'left');
