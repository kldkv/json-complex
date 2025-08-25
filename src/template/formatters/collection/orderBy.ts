import { FormatterFn } from '../../types';
import { hasOwn } from '../../utils/is';

/**
 * Сортирует массив объектов по одному или нескольким полям с указанием направления.
 * Поддерживает сигнатуры: orderBy(['a','asc'], ['b','desc']) или orderBy([[...] , [...]]).
 *
 * @param value Массив объектов.
 * @param params Пары [поле, направление].
 * @example
 * orderBy([
 *   {a:2,b:1}, {a:1,b:2}, {a:1,b:1}
 * ], ['a','asc'], ['b','desc'])
 * // => [{a:1,b:2}, {a:1,b:1}, {a:2,b:1}]
 */
export const orderBy: FormatterFn = (value: any, ...params: any[]) => {
  if (!Array.isArray(value)) return value;

  let pairs: Array<[string, 'asc' | 'desc']> = [];
  if (
    params.length === 1 &&
    Array.isArray(params[0]) &&
    Array.isArray(params[0][0])
  ) {
    pairs = params[0] as Array<[string, 'asc' | 'desc']>;
  } else {
    pairs = params as Array<[string, 'asc' | 'desc']>;
  }

  if (!pairs.length) return [...value];

  // Remeda v2 не предоставляет публичного API для композиций компараторов.
  // Сохраним читаемую реализацию: сортируем копию с учётом направлений.
  const copied = [...(value as any[])];
  copied.sort((a, b) => {
    for (const [field, dir] of pairs) {
      const av =
        a && typeof a === 'object' && hasOwn(a as object, field)
          ? (a as any)[field]
          : undefined;
      const bv =
        b && typeof b === 'object' && hasOwn(b as object, field)
          ? (b as any)[field]
          : undefined;
      const cmp = String(av).localeCompare(String(bv));
      if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
  return copied;
};
