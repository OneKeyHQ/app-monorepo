import type { ISettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import {
  getTravelModeSettingsControlState,
  updateWebAppLocalePreference,
} from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import type {
  ILocaleJSONSymbol,
  ILocaleSymbol,
} from '@onekeyhq/shared/src/locale';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import { LOCALES_OPTION } from '@onekeyhq/shared/src/locale/localeOptions';
import { createTimeoutPromise } from '@onekeyhq/shared/src/utils/promiseUtils';

export const OPTIONAL_SETTINGS_TIMEOUT_MS = 1000;

async function readAppSettings() {
  return (await getTravelModeSettingsControlState(
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

export async function readPreferredLocale() {
  return resolveLocale(await readLocalePreference());
}

// One visit keeps a stable request client. The current value only advances once
// the common App setting has been persisted, so the next request uses it.
export function createLocalePreference(initial: ILocaleSymbol) {
  let current = initial;
  return {
    get: () => current,
    async set(next: ILocaleSymbol) {
      if (current === next) return;
      await updateWebAppLocalePreference(next);
      current = next;
    },
  };
}
