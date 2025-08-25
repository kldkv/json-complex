import { FormatterFn } from '../../types';
import * as R from 'remeda';

type Operator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'startsWith'
  | 'endsWith';

type Clause = [string, Operator, any];

const BLOCKED = new Set(['__proto__', 'prototype', 'constructor']);

function getField(obj: unknown, field: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (BLOCKED.has(field)) return undefined;
  return (obj as any)[field];
}

function testClause(item: any, clause: Clause): boolean {
  const [field, op, val] = clause;
  const v = getField(item, field);
  switch (op) {
    case 'eq':
      return v === val;
    case 'ne':
      return v !== val;
    case 'gt':
      return Number(v) > Number(val);
    case 'gte':
      return Number(v) >= Number(val);
    case 'lt':
      return Number(v) < Number(val);
    case 'lte':
      return Number(v) <= Number(val);
    case 'in':
      return Array.isArray(val) ? val.includes(v) : false;
    case 'notIn':
      return Array.isArray(val) ? !val.includes(v) : true;
    case 'contains':
      return typeof v === 'string' && typeof val === 'string'
        ? v.includes(val)
        : false;
    case 'startsWith':
      return typeof v === 'string' && typeof val === 'string'
        ? v.startsWith(val)
        : false;
    case 'endsWith':
      return typeof v === 'string' && typeof val === 'string'
        ? v.endsWith(val)
        : false;
    default:
      return false;
  }
}

/**
 * Фильтрует массив объектов по множеству условий.
 * Поддерживаются операторы: 'eq','ne','gt','gte','lt','lte','in','notIn','contains','startsWith','endsWith'.
 * Последний аргумент может быть 'and' или 'or' для соединения условий.
 *
 * @example
 * filterBy(users, ['age','gte',18], ['active','eq',true], 'and')
 * filterBy(users, [ ['role','in',['admin','editor']], 'or' ])
 */
export const filterBy: FormatterFn = (value: any, ...params: any[]) => {
  if (!Array.isArray(value)) return value;

  // нормализуем вход: либо пришёл массив условий, либо varargs
  let clauses: Clause[] = [];
  let joiner: 'and' | 'or' = 'and';

  if (params.length === 1 && Array.isArray(params[0])) {
    // filterBy[[...], [...], ...] или filterBy[[...], [...], ..., 'and'|'or']
    const arr = params[0] as any[];
    if (arr.length > 0 && Array.isArray(arr[0])) {
      const maybeJoiner = arr[arr.length - 1];
      if (maybeJoiner === 'and' || maybeJoiner === 'or') {
        joiner = maybeJoiner;
        clauses = arr.slice(0, -1) as Clause[];
      } else {
        clauses = arr as Clause[];
      }
    }
  } else {
    // filterBy[[...], [...], ..., 'and']
    const last = params[params.length - 1];
    if (last === 'and' || last === 'or') {
      joiner = last;
      params = params.slice(0, -1);
    }
    clauses = params as Clause[];
  }

  if (!clauses.length) return value;

  const pred = (item: any) => {
    if (joiner === 'or') {
      for (const c of clauses) if (testClause(item, c)) return true;
      return false;
    }
    // and
    for (const c of clauses) if (!testClause(item, c)) return false;
    return true;
  };

  return R.filter(value, pred);
};
