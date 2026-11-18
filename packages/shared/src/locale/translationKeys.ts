import { ETranslations } from './enum/translations';

let translationKeys: ReadonlySet<string> | undefined;

export function isKnownTranslationKey(key: string): key is ETranslations {
  translationKeys ??= new Set(Object.values(ETranslations));
  return translationKeys.has(key);
}
