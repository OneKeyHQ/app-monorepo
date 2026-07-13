import { app } from 'electron';
import logger from 'electron-log/main';
import { isFunction } from 'lodash';

import type {
  ETranslations,
  ILocaleJSONSymbol,
  ILocaleSymbol,
} from '@onekeyhq/shared/src/locale';
import { ETranslations as ETranslationsShared } from '@onekeyhq/shared/src/locale/enum/translations';
import { LOCALES } from '@onekeyhq/shared/src/locale/localeJsonMap';

import * as store from './libs/store';

let globalLocale = 'en-US' as ILocaleSymbol;
let globalMessages: Record<ETranslations, string> = {} as unknown as Record<
  ETranslations,
  string
>;
export const getLocale = () => {
  const locales = Object.keys(LOCALES) as ILocaleSymbol[];
  const storeLocale = store.getLanguage();
  logger.info('store locale >>>> ', storeLocale);
  const current = storeLocale === 'system' ? app.getLocale() : storeLocale;

  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    if (locale === current) {
      return locale;
    }
  }
  const code = current.split('-')[0];
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    if (code === locale) {
      return locale;
    }
  }
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    if (locale.startsWith(`${code}-`)) {
      return locale;
    }
  }
  return 'en-US' as ILocaleSymbol;
};

export const getLocaleMessages = async (locale: ILocaleSymbol) => {
  const messagesBuilder = LOCALES[locale as ILocaleJSONSymbol];
  const loaded = isFunction(messagesBuilder)
    ? await messagesBuilder()
    : messagesBuilder;
  // Normalize the loaded shape. The dynamic locales go through `import()` and
  // come back as a module namespace ({ default: <table>, ...keys }) after
  // esbuild's CJS->ESM interop, while static en-US is the raw table. Unwrap
  // `.default` ONLY when it is an object (the namespace wrapper holds the full
  // translation table); a raw table's own values are strings, so this never
  // mis-unwraps a real translation whose key happens to be "default". Keeps
  // i18nText()/i18nFormat() reading keys consistently regardless of interop.
  const maybeDefault = (loaded as { default?: unknown } | null | undefined)
    ?.default;
  const normalized =
    typeof maybeDefault === 'object' && maybeDefault !== null
      ? maybeDefault
      : loaded;
  return normalized as Record<ETranslations, string>;
};

export const initLocale = async () => {
  globalLocale = getLocale();
  // Never let a locale-load failure reject: app.on('ready') awaits this before
  // createMainWindow(), so a throw here would block the main window from ever
  // opening. Fall back to en-US, then to empty messages (keys render raw).
  try {
    globalMessages = await getLocaleMessages(globalLocale);
  } catch (e) {
    logger.error('initLocale: failed to load messages, falling back to en-US', {
      locale: globalLocale,
      error: e,
    });
    try {
      globalMessages = await getLocaleMessages('en-US' as ILocaleSymbol);
    } catch (fallbackError) {
      logger.error('initLocale: en-US fallback failed, using empty messages', {
        error: fallbackError,
      });
      globalMessages = {} as unknown as Record<ETranslations, string>;
    }
  }
  return globalLocale;
};

export const i18nText = (key: ETranslations) =>
  globalMessages[key] ?? (key as unknown as string);

// Lightweight {placeholder} interpolation for main-process i18n.
// Mirrors react-intl's syntax for the simple variable substitution case so
// the same translation keys can be reused on both sides.
export const i18nFormat = (
  key: ETranslations,
  values?: Record<string, string | number>,
) => {
  const template = i18nText(key);
  if (!template) return key as unknown as string;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    values[name] === undefined ? `{${name}}` : String(values[name]),
  );
};

export const ElectronTranslations = ETranslationsShared;
