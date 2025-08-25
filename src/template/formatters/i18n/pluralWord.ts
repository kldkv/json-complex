import { FormatterFn } from '../../types';
import { getPluralIndexForRussian } from '../../utils/plural';

/**
 * Возвращает только словоформу без префикса количества.
 * Поддерживает двоичную форму [singular, plural] и тройную [1, few, many].
 *
 * @param value Число, boolean или пустое значение.
 * @param forms Словоформы: 2 или 3 элемента.
 * @example
 * pluralWord(1, 'товар', 'товара', 'товаров') // 'товар'
 * pluralWord(5, 'товар', 'товара', 'товаров') // 'товаров'
 */
export const pluralWord: FormatterFn = (value: any, ...forms: string[]) => {
  const isEmpty = value == null;
  const isBoolean = typeof value === 'boolean';
  const isNumber = typeof value === 'number';

  if (forms.length === 2) {
    // Двоичная форма: [singular, plural]
    if (isBoolean) {
      return forms[Number(value)] ?? forms[0] ?? '';
    }
    if (isNumber) {
      const idx = getPluralIndexForRussian(value);
      return (idx === 0 ? forms[0] : forms[1]) ?? forms[0] ?? '';
    }
    // Для пустого/других типов — используем первую как безопасное значение
    return forms[0] ?? '';
  }

  let pluralIndex = 0;
  if (isBoolean) {
    pluralIndex = Number(value);
  } else {
    pluralIndex = getPluralIndexForRussian(
      isEmpty ? undefined : (value as number),
    );
  }

  return forms[pluralIndex] ?? forms[0] ?? '';
};
