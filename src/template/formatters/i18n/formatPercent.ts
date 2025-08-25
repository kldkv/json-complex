import { FormatterFn } from '../../types';
import { toInteger } from '../../utils/number';
import type {
  PercentPresetMap,
  PercentPresetName,
} from '../../utils/percentPresets';

/**
 * Форматирует долю (0..1) как проценты. Поддерживает пресеты и явное количество знаков.
 *
 * @param presets Карта пресетов процентов.
 * @returns Функция-форматтер: (value, presetOrDigits?, locale?) => string
 * @example
 * const fmt = formatPercent(presets);
 * fmt(0.1234, 'percent1', 'ru') // '12,3%'
 * fmt(0.5, 0, 'ru') // '50%'
 */
export const formatPercent =
  (presets: PercentPresetMap): FormatterFn =>
  (
    value: any,
    presetOrDigits?: PercentPresetName | number,
    locale: string = 'ru',
  ) => {
    if (typeof value !== 'number') {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      value = num;
    }

    const scaled = value * 100;

    try {
      let options: Intl.NumberFormatOptions = presets.percent0 ?? {};
      if (typeof presetOrDigits === 'string') {
        options = presets[presetOrDigits] ?? options;
      } else if (typeof presetOrDigits === 'number') {
        const digits = presetOrDigits;
        options = {
          maximumFractionDigits: digits,
          minimumFractionDigits: digits,
        };
      }
      const numberPart = new Intl.NumberFormat(locale, options).format(scaled);
      return `${numberPart}%`;
    } catch {
      const digits =
        typeof presetOrDigits === 'number' ? presetOrDigits : toInteger('0');
      const factor = Math.pow(10, digits);
      const n = Math.round(scaled * factor) / factor;
      return `${n.toString().replace('.', ',')}%`;
    }
  };
