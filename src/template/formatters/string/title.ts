import { FormatterFn } from '../../types';
import { capitalizeFirst, toStringSafe } from '../../utils/string';
import { UNICODE_WHITESPACE_CLASS } from '../../utils/regex';

/**
 * Преобразует строку в «Title Case»: каждое слово с заглавной буквы.
 *
 * @param value Значение, приводится к строке.
 * @example
 * title('hello   world') // 'Hello World'
 */
export const title: FormatterFn = (value: any) => {
  const whitespaceRegex = new RegExp(`[${UNICODE_WHITESPACE_CLASS}]+`, 'u');
  return toStringSafe(value)
    .split(whitespaceRegex)
    .map((word) => {
      if (!word) return '';
      const lower = word.toLowerCase();
      return capitalizeFirst(lower);
    })
    .filter((word) => word !== '')
    .join(' ');
};
