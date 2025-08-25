import { FormatterFn } from '../../types';
import { toStringSafe } from '../../utils/string';
import { toInteger } from '../../utils/number';

/**
 * Дополняет строку слева или справа до нужной длины указанной подстрокой.
 *
 * @param value Значение, приводится к строке.
 * @param targetLength Желаемая длина.
 * @param padString Строка-дополнитель (по умолчанию пробел).
 * @param direction Направление дополнения ('left' | 'right').
 * @example
 * pad('7', 3, '0', 'left') // '007'
 */
export const pad: FormatterFn = (
  value: any,
  targetLength: number | string = 0,
  padString: string = ' ',
  direction: 'left' | 'right' = 'right',
) => {
  const length = toInteger(targetLength);
  const str = toStringSafe(value);
  return direction === 'left'
    ? str.padStart(length, padString)
    : str.padEnd(length, padString);
};
