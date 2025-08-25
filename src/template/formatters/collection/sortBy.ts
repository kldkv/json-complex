import { FormatterFn } from '../../types';

/**
 * Сортирует массив по строковому представлению значений, опционально по полю объекта.
 * Без кастомных компараторов, «стабильно» по String(value).
 *
 * @param value Массив значений или объектов.
 * @param field Поле объекта для сравнения. Если не указано — сравнение самих элементов.
 * @param direction Направление сортировки ('asc' | 'desc').
 * @example
 * sortBy([3,1,2]) // [1,2,3]
 * sortBy([{v:2},{v:1}], 'v', 'desc') // [{v:2},{v:1}]
 */
export const sortBy: FormatterFn = (
  value: any,
  field: string = '',
  direction: 'asc' | 'desc' = 'asc',
) => {
  if (!Array.isArray(value)) return value;
  const dir = direction === 'desc' ? -1 : 1;
  const copied = [...value];
  if (!field) {
    // простая сортировка по строковому представлению элементов
    copied.sort((a, b) => dir * String(a).localeCompare(String(b)));
    return copied;
  }
  copied.sort((a, b) => {
    const av =
      a != null && typeof a === 'object' ? (a as any)[field] : undefined;
    const bv =
      b != null && typeof b === 'object' ? (b as any)[field] : undefined;
    const cmp = String(av).localeCompare(String(bv));
    return dir * cmp;
  });
  return copied;
};
