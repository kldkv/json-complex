import { FormatterFn } from '../../types';
import { toStringSafe } from '../../utils/string';
import type { DatePresetName, DatePresetMap } from '../../utils/datePresets';

/**
 * Форматирует дату/время через Intl.DateTimeFormat и пресеты.
 *
 * @param presets Карта пресетов дат.
 * @returns Функция-форматтер: (value, optionsOrPreset?, locale?) => string
 * @example
 * const fmt = formatDateTime(presets);
 * fmt(new Date('2024-01-01T12:00:00Z'), 'date', 'ru')
 */
export const formatDateTime =
  (presets: DatePresetMap): FormatterFn =>
  (
    value: any,
    optionsOrPreset?: DatePresetName | Intl.DateTimeFormatOptions,
    locale: string = 'ru',
  ) => {
    try {
      let date: Date;

      if (value instanceof Date) {
        date = value;
      } else if (typeof value === 'string' || typeof value === 'number') {
        date = new Date(value as any);
      } else {
        return toStringSafe(value);
      }

      if (isNaN(date.getTime())) {
        return toStringSafe(value);
      }

      // по умолчанию, если явный пресет не передан, берём presets.datetime если он существует
      let options: Intl.DateTimeFormatOptions = presets.datetime ?? {};
      if (typeof optionsOrPreset === 'string') {
        const preset = optionsOrPreset as DatePresetName;
        options = presets[preset] ?? {};
      } else if (optionsOrPreset && typeof optionsOrPreset === 'object') {
        options = optionsOrPreset as Intl.DateTimeFormatOptions;
      }

      const dtf = new Intl.DateTimeFormat(locale, options);
      return dtf.format(date);
    } catch {
      return toStringSafe(value);
    }
  };
