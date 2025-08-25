import { FormatterFn } from '../../types';
import { toStringSafe } from '../../utils/string';
import { escapeRegExp, UNICODE_WHITESPACE_CLASS } from '../../utils/regex';

/**
 * Обрезает начало/конец строки по набору символов или по юникод-пробелам.
 *
 * @param value Значение, приводится к строке.
 * @param characters Строка символов для обрезки. Пусто — использовать пробелы.
 * @param direction Направление: 'left' | 'right' | 'both' (по умолчанию).
 * @example
 * trim('  hi  ') // 'hi'
 * trim('--hi--', '-', 'left') // 'hi--'
 */
export const trim: FormatterFn = (
  value: any,
  characters: string = '',
  direction: string = 'both',
) => {
  const str = toStringSafe(value);

  if (characters === '') {
    const whitespaceChars = UNICODE_WHITESPACE_CLASS;
    switch (direction) {
      case 'left':
        return str.replace(new RegExp(`^[${whitespaceChars}]+`, 'u'), '');
      case 'right':
        return str.replace(new RegExp(`[${whitespaceChars}]+$`, 'u'), '');
      case 'both':
      default:
        return str
          .replace(new RegExp(`^[${whitespaceChars}]+`, 'u'), '')
          .replace(new RegExp(`[${whitespaceChars}]+$`, 'u'), '');
    }
  }

  switch (direction) {
    case 'left':
      return str.replace(
        new RegExp(`^[${escapeRegExp(characters)}]+`, 'u'),
        '',
      );
    case 'right':
      return str.replace(
        new RegExp(`[${escapeRegExp(characters)}]+$`, 'u'),
        '',
      );
    case 'both':
    default:
      const pattern = `[${escapeRegExp(characters)}]`;
      return str
        .replace(new RegExp(`^${pattern}+`, 'u'), '')
        .replace(new RegExp(`${pattern}+$`, 'u'), '');
  }
};
