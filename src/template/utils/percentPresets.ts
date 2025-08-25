export type PercentPresetName = string;
export type PercentPresetMap = Record<
  PercentPresetName,
  Intl.NumberFormatOptions
>;

export const PRESETS: PercentPresetMap = {
  percent0: { maximumFractionDigits: 0, minimumFractionDigits: 0 },
  percent1: { maximumFractionDigits: 1, minimumFractionDigits: 1 },
  percent2: { maximumFractionDigits: 2, minimumFractionDigits: 2 },
};
