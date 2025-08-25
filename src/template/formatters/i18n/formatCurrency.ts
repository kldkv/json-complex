import { FormatterFn } from '../../types';
import { toStringSafe } from '../../utils/string';
import type {
  CurrencyPresetMap,
  CurrencyPresetName,
} from '../../utils/currencyPresets';

/**
 * Форматирует число как валюту с использованием Intl.NumberFormat и пресетов.
 *
 * @param presets Карта пресетов валюты.
 * @returns Функция-форматтер: (value, optionsOrPreset?, locale?) => string
 * @example
 * const fmt = formatCurrency(presets);
 * fmt(1234.5, 'RUB', 'ru') // '1 234,5 ₽' (зависит от среды)
 */
export const formatCurrency =
  (presets: CurrencyPresetMap): FormatterFn =>
  (
    value: any,
    optionsOrPreset?: CurrencyPresetName | Intl.NumberFormatOptions | string,
    locale: string = 'ru',
  ) => {
    if (typeof value !== 'number') {
      const num = Number(value);
      if (isNaN(num)) return toStringSafe(value);
      value = num;
    }
    try {
      let options: Intl.NumberFormatOptions & { currency?: string } =
        presets.RUB ?? {
          style: 'currency',
          currency: 'RUB',
          maximumFractionDigits: 2,
          minimumFractionDigits: 0,
        };

      if (typeof optionsOrPreset === 'string') {
        const preset = presets[optionsOrPreset as CurrencyPresetName];
        if (preset) {
          options = preset;
        } else {
          options = { style: 'currency', currency: optionsOrPreset };
        }
      } else if (optionsOrPreset && typeof optionsOrPreset === 'object') {
        options = optionsOrPreset as Intl.NumberFormatOptions & {
          currency?: string;
        };
        if (!options.style && options.currency) options.style = 'currency';
      }

      return new Intl.NumberFormat(locale, options).format(value);
    } catch {
      const currency =
        typeof optionsOrPreset === 'string'
          ? optionsOrPreset
          : ((optionsOrPreset as any)?.currency ?? 'RUB');
      const symbols: Record<string, string> = {
        RUB: '₽',
        USD: '$',
        EUR: '€',
      };
      const symbol = symbols[currency] || currency;
      try {
        return `${toStringSafe((value as number).toLocaleString(locale))} ${symbol}`;
      } catch {
        return `${String(value)} ${symbol}`;
      }
    }
  };
