// must keep this platformEnv import, otherwise the IDE will be very laggy when linting, don't know why
/*
Linting file xxx.tsx took 14762ms. Please check the ESLint rules for performance issues.
*/
import '@onekeyhq/shared/src/platformEnv';

import { LOCALE_LOADERS } from './localeLoaders';
import { LOCALES_OPTION } from './localeOptions';

import type { ILocaleSymbol } from './type';

export const LOCALES = LOCALE_LOADERS as unknown as Record<
  ILocaleSymbol,
  () => Promise<Record<string, string>>
>;

export { LOCALES_OPTION };

export * from './type';
export * from './enum/translations';
export * from './enum/translationsMock';
