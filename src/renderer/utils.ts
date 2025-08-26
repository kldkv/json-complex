// https://github.com/geelen/strict-url-sanitise/blob/main/src/index.ts

// Разрешённые протоколы для UI-сценариев (минимальный набор)
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function sanitizeMailto(raw: string, abort: () => never): string {
  // Убираем переносы/управляющие — защита от header-injection
  if (/\r|\n|\t/.test(raw)) abort();
  return raw;
}

function sanitizeTel(raw: string, abort: () => never): string {
  if (/\r|\n|\t/.test(raw)) abort();
  return raw;
}

function buildRelative(url: URL): string {
  const path = url.pathname;
  const search = url.search;
  const hash = url.hash;
  return `${path}${search}${hash}`;
}

function buildProtocolRelative(url: URL): string {
  const host = url.host; // включает порт
  const path = url.pathname;
  const search = url.search;
  const hash = url.hash;
  return `//${host}${path}${search}${hash}`;
}

export function sanitizeUrl(raw: string) {
  const abort = () => {
    throw new Error(`Invalid url to pass to open(): ${raw}`);
  };

  if (typeof raw !== 'string') abort();
  const input = raw.trim();
  if (!input) abort();

  const lower = input.toLowerCase();
  // Ранний отказ по явным опасным схемам
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    (lower.startsWith('data:') && !lower.startsWith('data:image/'))
  ) {
    abort();
  }

  // Якоря (#hash)
  if (input.startsWith('#')) {
    return `#${encodeURIComponent(input.slice(1))}`;
  }

  // mailto: и tel:
  if (/^mailto:/i.test(input)) return sanitizeMailto(input, abort);
  if (/^tel:/i.test(input)) return sanitizeTel(input, abort);

  const isProtocolRelative = input.startsWith('//');
  const isRootRelative = input.startsWith('/') && !isProtocolRelative;
  const isDotRelative = input.startsWith('./') || input.startsWith('../');

  let url!: URL;
  try {
    // Используем базу для относительных ссылок; в браузере — из document, иначе — фиктивная
    const base =
      typeof document !== 'undefined' && document?.location
        ? document.location.href
        : 'https://example.invalid/';
    url = new URL(input, base);
  } catch (_) {
    abort();
  }

  // Разрешаем только http(s) для URL-ресурсов (mailto/tel обработаны выше)
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) abort();

  // Запрещаем креды в http(s)
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    if (url.username || url.password) abort();
  }

  // Полагаться на URL для кодирования; без ручных регулярок

  // Собираем строку в зависимости от вида исходного ввода
  if (isProtocolRelative) return buildProtocolRelative(url);
  if (isRootRelative || isDotRelative) return buildRelative(url);
  return url.href;
}

export function sanitizeUrlList(raw: string): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    try {
      const s = sanitizeUrl(p);
      out.push(s);
    } catch {
      // skip invalid
    }
  }
  return out.length ? out.join(' ') : undefined;
}

export function sanitizeSrcSet(raw: string): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const item of items) {
    const tokens = item.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const urlToken = tokens[0];
    let sanitizedUrl: string | null = null;
    try {
      sanitizedUrl = sanitizeUrl(urlToken);
    } catch {
      sanitizedUrl = null;
    }
    if (!sanitizedUrl) continue;
    const desc = tokens[1];
    if (!desc) {
      out.push(sanitizedUrl);
      continue;
    }
    if (/^(?:\d+w|\d+(?:\.\d+)?x)$/i.test(desc)) {
      out.push(`${sanitizedUrl} ${desc}`);
    } else {
      // неизвестный дескриптор — игнорируем его, но сохраняем URL
      out.push(sanitizedUrl);
    }
  }
  return out.length ? out.join(', ') : undefined;
}
