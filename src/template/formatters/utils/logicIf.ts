import { FormatterFn } from '../../types';

/**
 * Условный выбор: если value truthy — вернуть thenValue, иначе elseValue.
 *
 * @param value Проверяемое значение.
 * @param thenValue Значение при истине.
 * @param elseValue Значение при лжи.
 * @example
 * logicIf(true, 'да', 'нет') // 'да'
 */
export const logicIf: FormatterFn = (
  value: any,
  thenValue: unknown = '',
  elseValue: unknown = '',
) => {
  const truthy = !!value;
  const selected = truthy ? thenValue : elseValue;
  return selected;
};

// алиас для удобства: if
export const ifFormatter = logicIf;
