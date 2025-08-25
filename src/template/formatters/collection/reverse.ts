import { FormatterFn } from '../../types';
import { toStringSafe, graphemeReverse } from '../../utils/string';

/**
 * Разворачивает массив или строку. Для массива возвращает строку, элементы соединяются запятой.
 * Для строки учитывает суррогатные пары и графемные кластеры.
 *
 * @param value Массив или строка.
 * @returns Развёрнутая строка.
 * @example
 * reverse([1,2,3]) // '3,2,1'
 * reverse('привет') // 'тевирп'
 */
export const reverse: FormatterFn = (value: any) => {
  if (Array.isArray(value)) {
    return [...value].reverse().join(',');
  }
  if (typeof value === 'string') {
    return graphemeReverse(toStringSafe(value));
  }
  return toStringSafe(value);
};
