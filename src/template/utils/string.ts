export function toStringSafe(value: unknown): string {
  return String(value);
}

export function capitalizeFirst(value: string): string {
  if (value.length === 0) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Возвращает массив графем (user-perceived characters).
 * Использует Intl.Segmenter при наличии, иначе — Array.from по code points.
 */
export function segmentGraphemes(input: string): string[] {
  try {
    // @ts-ignore
    if (typeof (Intl as any)?.Segmenter === 'function') {
      // @ts-ignore
      const segmenter = new (Intl as any).Segmenter(undefined, {
        granularity: 'grapheme',
      });
      const result: string[] = [];
      for (const seg of segmenter.segment(input)) {
        result.push((seg as any).segment ?? '');
      }
      return result;
    }
  } catch {}
  // Фолбэк: разбиваем по код-поинтам (корректно для суррогатных пар, но без combining marks)
  return Array.from(input);
}

export function graphemeLength(input: string): number {
  return segmentGraphemes(input).length;
}

export function graphemeSlice(
  input: string,
  start: number,
  end?: number,
): string {
  const parts = segmentGraphemes(input);
  return parts.slice(start, end).join('');
}

export function graphemeReverse(input: string): string {
  return segmentGraphemes(input).reverse().join('');
}
