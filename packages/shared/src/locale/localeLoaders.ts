import type { ETranslations } from './enum/translations';
import type { ILocaleJSONSymbol } from './type';

type ILocaleMessages = Record<ETranslations, string>;
type ILocaleModule = { default: ILocaleMessages } | ILocaleMessages;

const resolveLocaleModule = (module: ILocaleModule) =>
  'default' in module ? module.default : module;

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
  let messagesPromise = localeMessagesCache.get(locale);
  if (!messagesPromise) {
    messagesPromise = LOCALE_LOADERS[locale]();
    localeMessagesCache.set(locale, messagesPromise);
  }
  return messagesPromise;
}
