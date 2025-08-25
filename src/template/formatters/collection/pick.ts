import { FormatterFn } from '../../types';
import * as R from 'remeda';

/**
 * Возвращает новый объект только с указанными ключами. Для массива объектов — применяет к каждому элементу.
 *
 * @param value Объект или массив объектов.
 * @param keys Ключи для выборки.
 * @example
 * pick({a:1,b:2,c:3}, 'a','c') // {a:1,c:3}
 * pick([{a:1,b:2},{a:3,c:4}], 'a') // [{a:1},{a:3}]
 */
export const pick: FormatterFn = (value: any, ...keys: string[]) => {
  if (Array.isArray(value)) {
    return value.map((v) =>
      v && typeof v === 'object' ? R.pick(v as any, keys as any) : v,
    );
  }
  if (value && typeof value === 'object') {
    return R.pick(value as any, keys as any);
  }
  return value;
};
