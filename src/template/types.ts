export type FormatterFn = (value: any, ...args: any[]) => unknown;

// Конфигурация шаблонизатора
export type TemplateLimits = {
  formatterChain: number;
  pathSegments: number;
  keyLength: number;
  paramsLength: number;
};

export type TemplateConfig = {
  limits?: Partial<TemplateLimits>;
  // Правило плюрализации, по умолчанию — русское
  pluralRule?: (n?: number | null) => number;
  // Локаль по умолчанию для терминальных числовых/датных форматеров
  defaultLocale?: string;
};
