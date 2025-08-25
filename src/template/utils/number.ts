export function toNumberOrNaN(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

export function toInteger(value: number | string): number {
  if (typeof value === 'number') return Math.trunc(value);
  return parseInt(String(value), 10);
}

export function roundTo(value: number, precision: number): number {
  if (precision === 0) return Math.round(value);
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

export function ceilTo(value: number, precision: number): number {
  if (precision === 0) return Math.ceil(value);
  const factor = Math.pow(10, precision);
  return Math.ceil(value * factor) / factor;
}

export function floorTo(value: number, precision: number): number {
  if (precision === 0) return Math.floor(value);
  const factor = Math.pow(10, precision);
  return Math.floor(value * factor) / factor;
}
