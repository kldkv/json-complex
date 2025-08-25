export function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Полный набор пробельных символов, используемый в trim/title
export const UNICODE_WHITESPACE_CLASS =
  ' \t\n\r\v\f\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF';
