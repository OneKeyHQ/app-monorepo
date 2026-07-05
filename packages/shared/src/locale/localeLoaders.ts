import type { ILocaleJSONSymbol } from './type';

type ILocaleMessageId = FormatjsIntl.Message['ids'];
type ILocaleMessages = Record<ILocaleMessageId, string>;

const resolveLocaleModule = (module: unknown): ILocaleMessages => {
  const maybeModule = module as { default?: unknown };
  return (
    maybeModule && typeof maybeModule === 'object' && 'default' in maybeModule
      ? maybeModule.default
      : module
  ) as ILocaleMessages;
};

export const LOCALE_LOADERS = {
  bn: () => import('./json/bn.json').then(resolveLocaleModule),
  de: () => import('./json/de.json').then(resolveLocaleModule),
  'en-US': () => import('./json/en_US.json').then(resolveLocaleModule),
  es: () => import('./json/es.json').then(resolveLocaleModule),
  'fr-FR': () => import('./json/fr_FR.json').then(resolveLocaleModule),
  'hi-IN': () => import('./json/hi_IN.json').then(resolveLocaleModule),
  id: () => import('./json/id.json').then(resolveLocaleModule),
  'it-IT': () => import('./json/it_IT.json').then(resolveLocaleModule),
  'ja-JP': () => import('./json/ja_JP.json').then(resolveLocaleModule),
  'ko-KR': () => import('./json/ko_KR.json').then(resolveLocaleModule),
  pt: () => import('./json/pt.json').then(resolveLocaleModule),
  'pt-BR': () => import('./json/pt_BR.json').then(resolveLocaleModule),
  ru: () => import('./json/ru.json').then(resolveLocaleModule),
  'th-TH': () => import('./json/th_TH.json').then(resolveLocaleModule),
  'uk-UA': () => import('./json/uk_UA.json').then(resolveLocaleModule),
  vi: () => import('./json/vi.json').then(resolveLocaleModule),
  'zh-CN': () => import('./json/zh_CN.json').then(resolveLocaleModule),
  'zh-HK': () => import('./json/zh_HK.json').then(resolveLocaleModule),
  'zh-TW': () => import('./json/zh_TW.json').then(resolveLocaleModule),
  en: () => import('./json/en_US.json').then(resolveLocaleModule),
} satisfies Record<ILocaleJSONSymbol, () => Promise<ILocaleMessages>>;

export const LOCALE_KEYS = Object.keys(LOCALE_LOADERS) as ILocaleJSONSymbol[];

const localeMessagesCache = new Map<
  ILocaleJSONSymbol,
  Promise<ILocaleMessages>
>();

export function loadLocaleMessages(locale: ILocaleJSONSymbol) {
  const cachedMessagesPromise = localeMessagesCache.get(locale);
  if (cachedMessagesPromise) {
    return cachedMessagesPromise;
  }

  const nextPromise = LOCALE_LOADERS[locale]().catch((error: unknown) => {
    if (localeMessagesCache.get(locale) === nextPromise) {
      localeMessagesCache.delete(locale);
    }
    throw error;
  });
  localeMessagesCache.set(locale, nextPromise);
  return nextPromise;
}

export function __clearLocaleMessagesCacheForTests(locale?: ILocaleJSONSymbol) {
  if (locale) {
    localeMessagesCache.delete(locale);
    return;
  }
  localeMessagesCache.clear();
}
