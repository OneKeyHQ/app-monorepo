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
import { createTimeoutPromise } from '@onekeyhq/shared/src/utils/promiseUtils';

const settingsKey = buildJotaiStorageKey(EAtomNames.settingsPersistAtom);
export const OPTIONAL_SETTINGS_TIMEOUT_MS = 1000;

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
  const settings = await createTimeoutPromise({
    asyncFunc: () => readAppSettings().catch(() => undefined),
    timeout: OPTIONAL_SETTINGS_TIMEOUT_MS,
    timeoutResult: undefined,
  });
  return getPreferredLocale(settings?.locale);
}

export async function loadStartupRetryLabel() {
  const locale = resolveLocale(await readLocalePreference());
  const catalog = await loadLocaleMessages(locale);
  return catalog[ETranslations.global_retry];
}
