import { FormatterFn } from '../../types';
import { toInteger } from '../../utils/number';
import type {
  NumberPresetMap,
  NumberPresetName,
} from '../../utils/numberPresets';

/**
 * Форматирует число через Intl.NumberFormat, поддерживает пресеты и диапазон дробной части.
 *
 * @param presets Карта числовых пресетов.
 * @returns Функция-форматтер: (value, arg1?, arg2?, locale?) => string
 * @example
 * const fmt = formatNumber(presets);
 * fmt(1234.56, 'integer', 'ru')
 * fmt(1234.56, 0, 2, 'ru')
 */
export const formatNumber =
  (presets: NumberPresetMap): FormatterFn =>
  (
    value: any,
    arg1?: number | string | Intl.NumberFormatOptions,
    arg2?: number | string,
    locale: string = 'ru',
  ) => {
    if (typeof value !== 'number') {
      const num = Number(value);
      if (!Number.isFinite(num)) return '';
      value = num;
    }

    let options: Intl.NumberFormatOptions = presets.integer ?? {};

    try {
      if (typeof arg1 === 'string' && isNaN(Number(arg1))) {
        const preset = presets[arg1 as NumberPresetName];
        options = preset ? preset : {};
      } else if (arg1 && typeof arg1 === 'object') {
        options = arg1 as Intl.NumberFormatOptions;
      } else if (arg1 !== undefined || arg2 !== undefined) {
        const min = toInteger(String(arg1 ?? '0'));
        const max = toInteger(String(arg2 ?? String(min)));
        options = { minimumFractionDigits: min, maximumFractionDigits: max };
      }

      return new Intl.NumberFormat(locale, options).format(value);
    } catch {
      return '';
    }
  };
