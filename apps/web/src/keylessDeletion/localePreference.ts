import { EAtomNames } from '@onekeyhq/kit-bg/src/states/jotai/atomNames';
import type { ISettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import {
  buildJotaiStorageKey,
  onekeyJotaiStorage,
} from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import {
  ETranslations,
  type ILocaleJSONSymbol,
  type ILocaleSymbol,
} from '@onekeyhq/shared/src/locale';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';
import { LOCALES_OPTION } from '@onekeyhq/shared/src/locale/localeOptions';

const settingsKey = buildJotaiStorageKey(EAtomNames.settingsPersistAtom);

async function readAppSettings() {
  return (await onekeyJotaiStorage.getItem(
    settingsKey,
    {},
  )) as Partial<ISettingsPersistAtom>;
}

export function getPreferredLocale(preference?: string): ILocaleSymbol {
  return (
    LOCALES_OPTION.find(({ value }) => value === preference)?.value ?? 'system'
  );
}

export function resolveLocale(preference: ILocaleSymbol) {
  return (
    preference === 'system' ? getDefaultLocale() : preference
  ) as ILocaleJSONSymbol;
}

export async function readLocalePreference(): Promise<ILocaleSymbol> {
  const settings = await readAppSettings().catch(() => undefined);
  return getPreferredLocale(settings?.locale);
}

export async function saveLocalePreference(locale: ILocaleSymbol) {
  const settings = await readAppSettings();
  await onekeyJotaiStorage.setItem(settingsKey, { ...settings, locale });
}

export async function loadStartupRetryLabel() {
  const locale = resolveLocale(await readLocalePreference());
  const catalog = await loadLocaleMessages(locale);
  return catalog[ETranslations.global_retry];
}
