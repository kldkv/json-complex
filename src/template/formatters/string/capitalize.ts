import { FormatterFn } from '../../types';
import { toStringSafe, capitalizeFirst } from '../../utils/string';

/**
 * Делаёт первую букву строки заглавной, остальные — без изменений.
 *
 * @param value Любое значение, приводится к строке.
 * @example
 * capitalize('мир') // 'Мир'
 */
export const capitalize: FormatterFn = (value: any) => {
  return capitalizeFirst(toStringSafe(value));
};
