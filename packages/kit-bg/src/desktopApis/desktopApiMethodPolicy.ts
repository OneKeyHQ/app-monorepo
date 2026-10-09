import { desktopApiPublicMethods } from './desktopApiPublicMethods.generated';

const prototypeMethods = new Set([
  'constructor',
  '__proto__',
  'prototype',
  'toString',
  'toLocaleString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
]);

export const DESKTOP_API_ALLOWED_MODULES = Object.freeze(
  Object.keys(desktopApiPublicMethods),
);

export const isDesktopApiModuleAllowed = (module: unknown): module is string =>
  typeof module === 'string' &&
  Object.prototype.hasOwnProperty.call(desktopApiPublicMethods, module);

export const isDesktopApiMethodAllowed = (
  module: unknown,
  method: unknown,
): boolean =>
  isDesktopApiModuleAllowed(module) &&
  typeof method === 'string' &&
  !method.startsWith('_') &&
  !prototypeMethods.has(method) &&
  desktopApiPublicMethods[module].includes(method);
