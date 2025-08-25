export type NumberPresetName = string;
export type NumberPresetMap = Record<
  NumberPresetName,
  Intl.NumberFormatOptions
>;

export const PRESETS: NumberPresetMap = {
  integer: { maximumFractionDigits: 0, minimumFractionDigits: 0 },
  fixed1: { maximumFractionDigits: 1, minimumFractionDigits: 1 },
  fixed2: { maximumFractionDigits: 2, minimumFractionDigits: 2 },
  decimal2: { maximumFractionDigits: 2, minimumFractionDigits: 0 },
};
