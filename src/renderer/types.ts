import type { ComponentType } from 'react';

export type _Meta = {
  _meta?: {
    data?: unknown;
    analytics?: Partial<
      Record<'onMount' | 'onDestroy' | 'onClick' | 'onChange', { GA: string }>
    >;
  };
};

export type CustomElement =
  | {
      // Название компонента из доступного перечня компонентов
      component: string;
      props?: Record<string, unknown> & _Meta;
      children?: CustomChildren;
    }
  | string;

export type CustomChildren = Array<CustomElement | null> | CustomElement | null;

export type CustomChild = Exclude<CustomChildren, Array<unknown>>;

export type ComponentMap = Record<string, ComponentType<any>>;
