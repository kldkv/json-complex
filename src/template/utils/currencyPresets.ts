export type CurrencyPresetName = string;
export type CurrencyPresetMap = Record<
  CurrencyPresetName,
  Intl.NumberFormatOptions & { currency?: string }
>;

export const PRESETS: CurrencyPresetMap = {
  RUB: {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  },
  USD: {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  },
  EUR: {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  },
  money: { maximumFractionDigits: 2, minimumFractionDigits: 0 },
};
