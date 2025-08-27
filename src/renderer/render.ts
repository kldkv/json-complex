import { createElement, type ReactNode } from 'react';
import * as sjson from 'secure-json-parse';
import { sanitizeUrl, sanitizeUrlList, sanitizeSrcSet } from './utils';

import type {
  CustomElement,
  CustomChild,
  CustomChildren,
  ComponentMap,
} from './types';

const PROPS_FOR_PURGE_SET = new Set([
  'children',
  'dangerouslySetInnerHTML',
  '__proto__',
  'prototype',
  'key',
  'ref',
  'constructor',
]);

const URL_LIST_KEYS = new Set(['ping', 'archive']);

// Наборы ключей для URL
const URL_SINGLE_KEYS = new Set([
  'href',
  'to',
  'xlinkhref',
  'src',
  'poster',
  'formaction',
  'action',
  'cite',
  'longdesc',
  'background',
  'manifest',
  'profile',
  'codebase',
  'data',
]);

const prepareComponent = (
  components: ComponentMap,
  child: Extract<CustomElement, { component: string }>,
) => {
  const { component, props = Object.create(null), children } = child;
  const dirtyProps: Record<string, unknown> = Object.assign(
    Object.create(null),
    props,
  );

  const isComponentRegistered = Object.prototype.hasOwnProperty.call(
    components,
    component,
  );

  // Удаляем известные опасные пропсы и любые потенциальные обработчики событий
  Object.keys(dirtyProps).forEach((key) => {
    const keyLower = key.toLowerCase();
    if (PROPS_FOR_PURGE_SET.has(key) || /^on[A-Z]/.test(key)) {
      delete dirtyProps[key];
      return;
    }

    // Сбрасываем любые функции из пропсов (из JSON их не должно быть)
    const value = (dirtyProps as Record<string, unknown>)[key];
    if (typeof value === 'function') {
      delete dirtyProps[key];
      return;
    }

    // Санитизация object[data]
    if (
      component.toLowerCase() === 'object' &&
      keyLower === 'data' &&
      typeof value === 'string'
    ) {
      try {
        (dirtyProps as Record<string, unknown>)[key] = sanitizeUrl(value);
      } catch {
        delete dirtyProps[key];
      }
    }
  });

  const protectedProps = Object.assign(Object.create(null), dirtyProps);

  const Component = isComponentRegistered ? components[component] : null;

  return { Component, protectedProps, children } as const;
};

const renderComponent = (
  components: ComponentMap,
  child: CustomChild,
): ReactNode => {
  if (typeof child === 'string') {
    return child;
  }

  if (child == null) {
    return null;
  }

  const { Component, protectedProps, children } = prepareComponent(
    components,
    child as Extract<CustomElement, { component: string }>,
  );

  const elementChildren = (children ?? null) as CustomChildren;

  if (Array.isArray(elementChildren) && Component) {
    return createElement(
      Component,
      protectedProps,
      ...elementChildren.map((c) =>
        renderComponent(components, c as CustomChild),
      ),
    );
  }

  if (Component) {
    return createElement(
      Component,
      protectedProps,
      render(components, elementChildren),
    );
  }

  return null;
};

export const render = (
  components: ComponentMap,
  children: CustomChildren | string,
): ReactNode | ReactNode[] => {
  if (typeof children === 'string') {
    try {
      const parsed = sjson.parse(
        children,
        (key: string, value: unknown) => {
          const keyLower = typeof key === 'string' ? key.toLowerCase() : key;

          if (keyLower !== 'children' && PROPS_FOR_PURGE_SET.has(key)) {
            return undefined;
          }

          // Санитизация URL-подобных пропсов на этапе парсинга
          if (typeof value === 'string') {
            if (URL_SINGLE_KEYS.has(keyLower)) {
              try {
                return sanitizeUrl(value);
              } catch {
                return undefined;
              }
            }

            if (URL_LIST_KEYS.has(keyLower)) {
              return sanitizeUrlList(value) ?? undefined;
            }

            if (keyLower === 'srcset') {
              return sanitizeSrcSet(value) ?? undefined;
            }
          }
          return value;
        },
        { protoAction: 'remove', constructorAction: 'remove' } as any,
      );
      return render(components, parsed as CustomChildren);
    } catch {
      return null;
    }
  }

  if (children == null) {
    return null;
  }

  if (Array.isArray(children)) {
    return children.map((child) =>
      renderComponent(components, child as CustomChild),
    );
  }

  return renderComponent(components, children);
};
