import { FormatterFn } from '../../types';
import { hasOwn } from '../../utils/is';

/**
 * Извлекает значение указанного поля из каждого элемента массива объектов.
 * Отсутствующие поля превращаются в undefined.
 *
 * @param value Массив объектов.
 * @param field Имя поля для извлечения.
 * @example
 * pluck([{id:1},{id:2}], 'id') // [1,2]
 */
export const pluck: FormatterFn = (value: any, field: string = '') => {
  if (!Array.isArray(value)) return value;
  return value.map((x) => {
    if (x != null && typeof x === 'object') {
      return hasOwn(x as object, field) ? (x as any)[field] : undefined;
    }
    return undefined;
  });
};
