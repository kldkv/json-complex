import * as F from './formatters';
import { createTemplate } from './lib';

export const template = createTemplate({
  default: F.defaultFormatter,
  ...F,
});
