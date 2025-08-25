import { FormatterFn } from '../../types';
import * as R from 'remeda';

/**
 * Возвращает копию объекта без указанных ключей. Для массива объектов — применяет к каждому элементу.
 *
 * @param value Объект или массив объектов.
 * @param keys Ключи для исключения.
 * @example
 * omit({a:1,b:2}, 'a') // {b:2}
 * omit([{a:1,b:2},{a:3,c:4}], 'a') // [{b:2},{c:4}]
 */
export const omit: FormatterFn = (value: any, ...keys: string[]) => {
  if (Array.isArray(value)) {
    return value.map((v) =>
      v && typeof v === 'object' ? R.omit(v as any, keys as any) : v,
    );
  }
  if (value && typeof value === 'object') {
    return R.omit(value as any, keys as any);
  }
  return value;
};
