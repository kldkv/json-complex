import { FormatterFn } from '../../types';

/**
 * Обрамляет значение строками до и после.
 *
 * @param value Значение для обрамления.
 * @param before Префикс.
 * @param after Суффикс.
 * @example
 * framing('x', '<', '>') // '<x>'
 */
export const framing: FormatterFn = (value: any, before = '', after = '') => {
  return `${before}${value ?? ''}${after}`;
};
