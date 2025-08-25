import { FormatterFn } from '../../types';
import * as R from 'remeda';
import { hasOwn } from '../../utils/is';

/**
 * Возвращает массив уникальных элементов. Для массивов объектов можно указать поле.
 *
 * @param value Массив значений или объектов.
 * @param field Поле объекта для уникальности. Если не указано — сравнение по ===.
 * @example
 * unique([1,1,2]) // [1,2]
 * unique([{id:1},{id:1},{id:2}], 'id') // [{id:1},{id:2}]
 */
export const unique: FormatterFn = (value: any, field?: string) => {
  if (!Array.isArray(value)) return value;
  if (!field) return R.unique(value as any);
  return R.uniqueBy(value as any, (v) => {
    if (v != null && typeof v === 'object') {
      return hasOwn(v as object, field) ? (v as any)[field] : undefined;
    }
    return undefined;
  });
};
