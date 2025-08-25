export type DatePresetName = string;
export type DatePresetMap = Record<DatePresetName, Intl.DateTimeFormatOptions>;

export const PRESETS: DatePresetMap = {
  date: { year: 'numeric', month: '2-digit', day: '2-digit' },
  time: {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  },
  datetime: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  },
};
