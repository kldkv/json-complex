// import * as R from 'remeda';
import { UNICODE_WHITESPACE_CLASS } from './utils/regex';
import { isObjectLike, hasOwn as hasOwnUtil } from './utils/is';
import type { FormatterFn, TemplateLimits, TemplateConfig } from './types';

// JSON-подобные данные
export type JSONLike =
  | null
  | boolean
  | number
  | string
  | JSONLike[]
  | { [k: string]: JSONLike };

type FormatterRegistry = Record<string, FormatterFn>;

// Контекст выполнения форматтеров (this)
type FormatterContext = Readonly<{
  defaultLocale?: string;
  pluralRule?: (n?: number | null) => number;
  // Вспомогательный рендерер для вложенных шаблонов (возвращает НЕэкранированный результат)
  renderNested?: (template: string, data?: unknown) => string;
}>;

export type TemplaterOptions = TemplateConfig & {
  autoTrim?: boolean | [boolean, boolean];
  escapeFunction?: (value: unknown) => string;
  parse?: (source: unknown) => JSONLike;
  varName?: string; // имя корневого объекта, по умолчанию 'it'
};

type RuntimeOptions = Required<
  Pick<TemplaterOptions, 'autoTrim' | 'escapeFunction' | 'parse' | 'varName'>
> & {
  limits: Required<TemplateLimits>;
  defaultLocale?: string;
  pluralRule?: (n?: number | null) => number;
};

export type TemplateInstance = ((template: string, data: unknown) => string) & {
  registerFormatter: (name: string, fn: FormatterFn) => void;
  unregisterFormatter: (name: string) => void;
  listFormatters: () => string[];
  getOptions: () => RuntimeOptions;
};

const DEFAULT_LIMITS: Required<TemplateLimits> = {
  formatterChain: 8,
  pathSegments: 32,
  keyLength: 128,
  paramsLength: 4096,
};

function defaultParse(source: unknown): JSONLike {
  return JSON.parse(String(source)) as JSONLike;
}

const DEFAULT_OPTIONS: RuntimeOptions = {
  autoTrim: false,
  escapeFunction: htmlEscape,
  parse: defaultParse,
  varName: 'it',
  limits: DEFAULT_LIMITS,
};

// Безопасное HTML-экранирование
function htmlEscape(value: unknown): string {
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isBannedKey(key: string): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

function toTrimPair(
  autoTrim: boolean | [boolean, boolean],
): [boolean, boolean] {
  return Array.isArray(autoTrim) ? autoTrim : [autoTrim, autoTrim];
}

function trimRightUnicodeWhitespace(input: string): string {
  const re = new RegExp(`[${UNICODE_WHITESPACE_CLASS}]+$`, 'u');
  return input.replace(re, '');
}

function trimLeftUnicodeWhitespace(input: string): string {
  const re = new RegExp(`^[${UNICODE_WHITESPACE_CLASS}]+`, 'u');
  return input.replace(re, '');
}

type Token = { start: number; end: number; expr: string };

// Поиск небэкслеш-экранированных {{ ... }} с учетом кавычек/скобок внутри
function tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  const len = template.length;
  let i = 0;
  while (i < len) {
    let open = template.indexOf('{{', i);
    if (open === -1) break;
    // Проверяем, не экранировано ли
    let backslashCount = 0;
    for (let k = open - 1; k >= 0 && template[k] === '\\'; k--)
      backslashCount++;
    if (backslashCount % 2 === 1) {
      i = open + 2;
      continue;
    }

    // Найти закрывающиеся }} игнорируя их внутри кавычек и скобок
    let j = open + 2;
    let inSingle = false;
    let inDouble = false;
    let squareDepth = 0;
    let curlyDepth = 0;
    while (j < len) {
      const ch = template[j];
      const prev = j > 0 ? template[j - 1] : '';
      if (ch === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
      else if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
      else if (!inSingle && !inDouble) {
        if (ch === '[') squareDepth++;
        else if (ch === ']') squareDepth = Math.max(0, squareDepth - 1);
        else if (ch === '{') curlyDepth++;
        else if (ch === '}') {
          // возможное окончание тега, но только если следующий '}' и мы не внутри структур
          if (curlyDepth > 0) {
            curlyDepth--;
          } else if (template[j + 1] === '}' && squareDepth === 0) {
            // Проверим, что }} тоже не экранированы
            let b = 0;
            for (let t = j - 1; t >= 0 && template[t] === '\\'; t--) b++;
            if (b % 2 === 0) {
              const end = j + 2;
              const expr = template.slice(open + 2, j).trim();
              tokens.push({ start: open, end, expr });
              i = end;
              break;
            }
          }
        }
      }
      j++;
    }
    if (j >= len) {
      // незакрытый маркер — трактуем как текст
      break;
    }
  }
  return tokens;
}

function splitPipeline(expr: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let inSingle = false;
  let inDouble = false;
  let squareDepth = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    const prev = i > 0 ? expr[i - 1] : '';
    if (ch === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
    else if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === '[') squareDepth++;
      else if (ch === ']') squareDepth = Math.max(0, squareDepth - 1);
      else if (ch === '+' && expr[i + 1] === '>' && squareDepth === 0) {
        parts.push(expr.slice(start, i).trim());
        start = i + 2;
        i++;
      }
    }
  }
  parts.push(expr.slice(start).trim());
  return parts.filter((p) => p.length > 0);
}

function normalizeJsonishArrayText(source: string): string {
  // Преобразует массив с одинарными кавычками в валидный JSON
  // Умеет в экранирование внутри одинарных кавычек
  let out = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (escape) {
      // переносим экранирование как есть, но если было \' внутри одинарных, превратим в \"
      if (inSingle && ch === "'") {
        out += '\\"';
      } else {
        out += '\\' + ch;
      }
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      out += '"';
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      out += '"';
      continue;
    }
    out += ch;
  }
  return out;
}

function isPositionInsideStringLiteral(text: string, pos: number): boolean {
  let inSingle = false;
  let inDouble = false;
  let escape = false;
  for (let i = 0; i < pos && i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
  }
  return inSingle || inDouble;
}

function jsonLiteralForValue(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'number')
    return Number.isFinite(value as number)
      ? String(value)
      : JSON.stringify(String(value));
  if (t === 'boolean') return (value as boolean) ? 'true' : 'false';
  if (t === 'string') return JSON.stringify(value as string);
  try {
    return JSON.stringify(value as any);
  } catch {
    return JSON.stringify(String(value));
  }
}

function jsonEscapedStringContent(value: unknown): string {
  // Возвращает содержимое JSON-строки без внешних кавычек
  return (JSON.stringify(String(value)) || '""').slice(1, -1);
}

function evaluateExprToValue(
  expr: string,
  data: unknown,
  registry: FormatterRegistry,
  options: RuntimeOptions,
): unknown {
  const steps = splitPipeline(expr);
  const path = parsePath(steps[0], options);
  const { found, value: base } =
    path.length === 0
      ? { found: true, value: data }
      : safeGetWithFound(data, path);
  return applyPipeline(base, steps, registry, options, found, data);
}

function interpolateArgsText(
  text: string,
  data: unknown,
  registry: FormatterRegistry,
  options: RuntimeOptions,
): string {
  const tokens = tokenize(text);
  if (tokens.length === 0) return text;
  let cursor = 0;
  const out: string[] = [];
  for (const token of tokens) {
    const left = text.slice(cursor, token.start);
    out.push(left);
    const value = evaluateExprToValue(token.expr, data, registry, options);
    const inside = isPositionInsideStringLiteral(text, token.start);
    const replacement = inside
      ? jsonEscapedStringContent(value)
      : jsonLiteralForValue(value);
    out.push(replacement);
    cursor = token.end;
  }
  out.push(text.slice(cursor));
  return out.join('');
}

function parseArgs(
  text: string,
  options: RuntimeOptions,
  data: unknown,
  registry: FormatterRegistry,
): unknown[] {
  // text вида "[ ... ]"
  const inner = text.trim();
  if (!inner.startsWith('[') || !inner.endsWith(']')) return [];
  const withInterpolated = interpolateArgsText(inner, data, registry, options);
  const jsonish = normalizeJsonishArrayText(withInterpolated);
  let parsed: JSONLike;
  try {
    parsed = options.parse(jsonish) as JSONLike;
  } catch (e) {
    throw new Error('Failed to parse formatter arguments');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Formatter arguments must be an array');
  }
  if (parsed.length > options.limits.paramsLength) {
    throw new Error('Too many formatter arguments');
  }
  return parsed as unknown[];
}

type ParsedStep = { name: string; args: unknown[] };

function parseStep(
  step: string,
  options: RuntimeOptions,
  data: unknown,
  registry: FormatterRegistry,
): ParsedStep {
  // Ищем верхнеуровневые скобки аргументов
  let inSingle = false;
  let inDouble = false;
  let squareDepth = 0;
  let argStart = -1;
  for (let i = 0; i < step.length; i++) {
    const ch = step[i];
    const prev = i > 0 ? step[i - 1] : '';
    if (ch === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
    else if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === '[') {
        if (squareDepth === 0) argStart = i;
        squareDepth++;
      } else if (ch === ']') {
        squareDepth = Math.max(0, squareDepth - 1);
      }
    }
  }
  let name = step.trim();
  let args: unknown[] = [];
  if (argStart !== -1) {
    name = step.slice(0, argStart).trim();
    const argsText = step.slice(argStart).trim();
    args = parseArgs(argsText, options, data, registry);
  }
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) {
    throw new Error(`Invalid formatter name: ${name}`);
  }
  return { name, args };
}

function assertWithinLimits(segments: string[], options: RuntimeOptions) {
  if (segments.length > options.limits.pathSegments) {
    throw new Error('Too many path segments');
  }
  for (const segment of segments) {
    if (segment.length === 0) continue;
    if (segment.length > options.limits.keyLength) {
      throw new Error('Path segment too long');
    }
  }
}

function parsePath(
  pathRaw: string,
  options: RuntimeOptions,
): (string | number)[] {
  let path = pathRaw.trim();
  if (!path) return [];
  // Поддержка имени корневого объекта: it.xxx
  const varPrefix = options.varName + '.';
  if (path.startsWith(varPrefix)) path = path.slice(varPrefix.length);
  const segments = path.split('.').filter((s) => s.length > 0);
  assertWithinLimits(segments, options);
  return segments.map((seg) => (/^\d+$/.test(seg) ? Number(seg) : seg));
}

const hasOwn = hasOwnUtil;

function safeGetWithFound(
  root: unknown,
  path: (string | number)[],
): { found: boolean; value: unknown } {
  return path.reduce<{ found: boolean; value: unknown }>(
    (acc, segment) => {
      if (!acc.found) return acc;
      const current = acc.value;
      if (current == null) return { found: false, value: undefined };
      if (typeof segment === 'number') {
        if (!Array.isArray(current)) return { found: false, value: undefined };
        return { found: true, value: (current as unknown[])[segment] };
      }
      if (isBannedKey(segment)) return { found: false, value: undefined };
      if (!isObjectLike(current)) return { found: false, value: undefined };
      const obj = current as Record<string, unknown>;
      if (!hasOwn(obj, segment)) return { found: false, value: undefined };
      return { found: true, value: obj[segment] };
    },
    { found: true, value: root },
  );
}

function unescapeBraces(text: string): string {
  return text.replace(/\\(\{\{|\}\})/g, '$1');
}

function extractFormatterName(step: string): string {
  // Извлекаем имя форматтера до верхнеуровневой '['
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < step.length; i++) {
    const ch = step[i];
    const prev = i > 0 ? step[i - 1] : '';
    if (ch === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
    else if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === '[') return step.slice(0, i).trim();
    }
  }
  return step.trim();
}

function looksLikeLocale(x: unknown): x is string {
  return typeof x === 'string' && x.includes('-');
}

function maybeInjectLocale(
  name: string,
  args: unknown[],
  defaultLocale?: string,
): unknown[] {
  if (!defaultLocale) return args;
  if (name === 'formatNumber') {
    if (args.length === 0) return [undefined, undefined, defaultLocale];
    if (args.length === 1) {
      return looksLikeLocale(args[0])
        ? args
        : [args[0], undefined, defaultLocale];
    }
    if (args.length === 2) {
      return looksLikeLocale(args[1])
        ? args
        : [args[0], args[1], defaultLocale];
    }
    return args;
  }
  if (
    name === 'formatCurrency' ||
    name === 'formatPercent' ||
    name === 'formatDateTime'
  ) {
    if (args.length === 0) return [undefined, defaultLocale];
    if (args.length === 1)
      return looksLikeLocale(args[0]) ? args : [args[0], defaultLocale];
    return args;
  }
  return args;
}

function applyPipeline(
  value: unknown,
  steps: string[],
  registry: FormatterRegistry,
  options: RuntimeOptions,
  foundFirst: boolean,
  rootData: unknown,
): unknown {
  const [_head, ...formatters] = steps;
  if (formatters.length === 0) return value;
  const allowedCount = Math.min(
    formatters.length,
    options.limits.formatterChain,
  );
  const effective = formatters.slice(0, allowedCount);
  const runtimeCtx: FormatterContext = {
    defaultLocale: options.defaultLocale,
    pluralRule: options.pluralRule,
    renderNested: (tpl: string, data?: unknown) =>
      renderCore(
        tpl,
        data === undefined ? rootData : (data as unknown),
        registry,
        options,
        false,
      ),
  };

  const chain = effective
    .map((rawStep, index) => {
      const name = extractFormatterName(rawStep);
      const entry = registry[name];
      if (!entry) return null;
      const { args } = parseStep(rawStep, options, rootData, registry);
      const finalArgs = maybeInjectLocale(name, args, options.defaultLocale);
      const run = (input: unknown) =>
        (entry as any).call(runtimeCtx, input, ...(finalArgs as any[]));
      return { idx: index, name, run };
    })
    .filter(
      (
        s,
      ): s is { idx: number; name: string; run: (input: unknown) => unknown } =>
        !!s,
    )
    .filter((s) =>
      s.idx === 0 && !foundFirst
        ? s.name === 'default' || s.name.startsWith('to')
        : true,
    );

  return chain.reduce<unknown>((acc, step) => step.run(acc), value);
}

function stringifyInserted(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return '';
  return String(value);
}

function renderCore(
  template: string,
  data: unknown,
  registry: FormatterRegistry,
  options: RuntimeOptions,
  escapeFinal: boolean,
): string {
  const tokens = tokenize(template);
  if (tokens.length === 0)
    return escapeFinal
      ? options.escapeFunction(unescapeBraces(template))
      : unescapeBraces(template);
  const [trimLeft, trimRight] = toTrimPair(options.autoTrim);
  let cursor = 0;
  let pendingRightTrim = false;
  const parts: string[] = [];
  for (const token of tokens) {
    let leftText = template.slice(cursor, token.start);
    if (pendingRightTrim) {
      leftText = trimLeftUnicodeWhitespace(leftText);
      pendingRightTrim = false;
    }
    if (trimLeft) leftText = trimRightUnicodeWhitespace(leftText);
    parts.push(unescapeBraces(leftText));

    const steps = splitPipeline(token.expr);
    if (steps.length === 0) {
      parts.push('');
    } else {
      const path = parsePath(steps[0], options);
      const { found, value: base } =
        path.length === 0
          ? { found: true, value: data }
          : safeGetWithFound(data, path);
      const raw = applyPipeline(base, steps, registry, options, found, data);
      parts.push(stringifyInserted(raw));
    }

    cursor = token.end;
    if (trimRight) pendingRightTrim = true;
  }
  let tail = template.slice(cursor);
  if (pendingRightTrim) tail = trimLeftUnicodeWhitespace(tail);
  parts.push(unescapeBraces(tail));
  const joined = parts.join('');
  return escapeFinal ? options.escapeFunction(joined) : joined;
}

function render(
  template: string,
  data: unknown,
  registry: FormatterRegistry,
  options: RuntimeOptions,
): string {
  return renderCore(template, data, registry, options, true);
}

function normalizeRegistry(
  initial: Record<string, FormatterFn>,
): FormatterRegistry {
  return Object.entries(initial).reduce<FormatterRegistry>(
    (acc, [name, fn]) => {
      if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) return acc;
      acc[name] = fn;
      return acc;
    },
    {},
  );
}

// builtin'ы вынесены в ./builtins.ts и добавляются при создании инстанса

export function createTemplate(
  formatters: Record<string, FormatterFn>,
  opts?: TemplaterOptions,
): TemplateInstance {
  const limits: Required<TemplateLimits> = {
    ...DEFAULT_LIMITS,
    ...(opts?.limits ?? {}),
  } as Required<TemplateLimits>;
  const options: RuntimeOptions = {
    ...DEFAULT_OPTIONS,
    ...opts,
    autoTrim: opts?.autoTrim ?? DEFAULT_OPTIONS.autoTrim,
    escapeFunction: opts?.escapeFunction ?? DEFAULT_OPTIONS.escapeFunction,
    parse: opts?.parse ?? DEFAULT_OPTIONS.parse,
    varName: opts?.varName ?? DEFAULT_OPTIONS.varName,
    limits,
  };
  const registry: FormatterRegistry = normalizeRegistry({ ...formatters });

  const api = ((templateStr: string, data: unknown) => {
    return render(templateStr, data, registry, options);
  }) as TemplateInstance;

  api.registerFormatter = (name: string, fn: FormatterFn) => {
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) {
      throw new Error('Invalid formatter name');
    }
    registry[name] = fn;
  };
  api.unregisterFormatter = (name: string) => {
    delete registry[name];
  };
  api.listFormatters = () => Object.keys(registry);
  api.getOptions = () => options;

  return api;
}
