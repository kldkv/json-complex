import { FormatterFn } from '../../types';
import * as R from 'remeda';
import { hasOwn } from '../../utils/is';

/**
 * Возвращает массив уникальных элементов. Для массивов объектов можно указать поле для уникальности.
 *
 * @param value Массив значений или объектов.
 * @param field Ключ объекта, по которому обеспечивается уникальность. Если не указан — сравнение по ===.
 * @example
 * distinctBy([1,1,2,3]) // [1,2,3]
 * distinctBy([{id:1},{id:1},{id:2}], 'id') // [{id:1},{id:2}]
 */
export const distinctBy: FormatterFn = (value: any, field: string = '') => {
  if (!Array.isArray(value)) return value;
  if (!field) return R.unique(value as any);
  return R.uniqueBy(value as any, (x) => {
    if (x && typeof x === 'object') {
      return hasOwn(x as object, field) ? (x as any)[field] : undefined;
    }
    return undefined;
  });
};
