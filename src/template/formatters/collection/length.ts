import { FormatterFn } from '../../types';
import { isObjectLike } from '../../utils/is';
import { graphemeLength } from '../../utils/string';

/**
 * Возвращает длину значения:
 * - строки (по графемам),
 * - массива (количество элементов),
 * - объекта (количество собственных ключей),
 * иначе 0.
 *
 * @example
 * length('привет') // 6
 * length([1,2,3]) // 3
 * length({a:1,b:2}) // 2
 */
export const length: FormatterFn = (value: any) => {
  if (typeof value === 'string') {
    return graphemeLength(value);
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  if (isObjectLike(value)) {
    return Object.keys(value).length;
  }
  return 0;
};
