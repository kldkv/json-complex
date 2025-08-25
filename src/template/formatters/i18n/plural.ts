import { FormatterFn } from '../../types';
import { getPluralIndexForRussian } from '../../utils/plural';

/**
 * Возвращает строку с числом и правильной словоформой по русскому правилу.
 * Также поддерживает булевы значения: false -> форма[0], true -> форма[1].
 *
 * @param value Число, boolean или пустое значение.
 * @param forms Список словоформ: обычно ["товар", "товара", "товаров"].
 * @example
 * plural(1, 'товар', 'товара', 'товаров') // '1 товар'
 * plural(2, 'товар', 'товара', 'товаров') // '2 товара'
 * plural(5, 'товар', 'товара', 'товаров') // '5 товаров'
 */
export const plural: FormatterFn = (value: any, ...forms: string[]) => {
  const isEmpty = value == null;
  const isBoolean = typeof value === 'boolean';
  const isNumber = typeof value === 'number';

  let pluralIndex = 0;

  if (isBoolean) {
    pluralIndex = Number(value);
  }

  if (isNumber || isEmpty) {
    pluralIndex = getPluralIndexForRussian(value as unknown as number);
  }

  const selectedForm = forms[pluralIndex] ?? forms[0] ?? '';

  if (isEmpty) {
    return selectedForm;
  }

  return isBoolean ? selectedForm : `${value} ${selectedForm}`;
};
