import { FormatterFn } from '../../types';

/**
 * Генерирует случайное число в диапазоне [lower, upper].
 * Если floating=true — возвращает дробное число строкой, иначе целое строкой.
 *
 * @param _ Игнорируемое входное значение.
 * @param lower Нижняя граница (включительно).
 * @param upper Верхняя граница (включительно для целых).
 * @param floating Вернуть дробное значение.
 * @example
 * random(null, 1, 3) // '1' | '2' | '3'
 */
export const random: FormatterFn = (
  _: any,
  lower = 0,
  upper = 100,
  floating = false,
) => {
  const lo = Number(lower);
  const hi = Number(upper);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return String(NaN);
  if (floating) {
    const r = Math.random() * (hi - lo) + lo;
    return `${r}`;
  }
  const min = Math.ceil(Math.min(lo, hi));
  const max = Math.floor(Math.max(lo, hi));
  const r = Math.floor(Math.random() * (max - min + 1)) + min;
  return `${r}`;
};
