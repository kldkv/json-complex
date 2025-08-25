export function isObjectLike(value: unknown): value is object {
  return value !== null && typeof value === 'object';
}

export function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
