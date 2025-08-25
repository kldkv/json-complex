import { FormatterFn } from '../../types';
import { hasOwn } from '../../utils/is';

/**
 * Группирует массив объектов по значению указанного поля.
 *
 * @param value Массив объектов.
 * @param field Имя поля для группировки.
 * @returns Объект, где ключ — значение поля, а значение — массив элементов.
 * @example
 * groupBy([
 *   {cat: 'a', v: 1},
 *   {cat: 'b', v: 2},
 *   {cat: 'a', v: 3},
 * ], 'cat')
 * // {
 * //   'a': [{cat:'a',v:1}, {cat:'a',v:3}],
 * //   'b': [{cat:'b',v:2}]
 * // }
 */
export const groupBy: FormatterFn = (value: any, field: string = '') => {
  if (!Array.isArray(value) || !field) return value;
  const out: Record<string, any[]> = Object.create(null);
  for (const item of value as any[]) {
    let key = 'undefined';
    if (item && typeof item === 'object') {
      if (hasOwn(item as object, field)) {
        const kv = (item as any)[field];
        key = String(kv);
      }
    }
    if (!hasOwn(out, key)) out[key] = [];
    out[key].push(item);
  }
  return out;
};
