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
import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';
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

// The request client and UI share this visit's locale, even while IndexedDB
// is blocked. Keep the actual writes serialized so older transactions cannot
// finish after a newer choice and overwrite it.
export function createLocalePreference(initial: ILocaleSymbol) {
  let current = initial;
  let requestedRevision = 0;
  let appliedRevision = 0;
  let pendingWrite = Promise.resolve();

  return {
    get: () => current,
    async change(next: ILocaleSymbol) {
      requestedRevision += 1;
      const revision = requestedRevision;
      await loadLocaleMessages(resolveLocale(next));
      if (revision !== requestedRevision) return undefined;

      current = next;
      appliedRevision = revision;
      const isCurrent = () => revision === appliedRevision;
      const persisted = pendingWrite.then(async () => {
        if (!isCurrent()) return false;
        try {
          await updateWebAppLocalePreference(next);
          return true;
        } catch {
          return false;
        }
      });
      pendingWrite = persisted.then(() => undefined);

      return { isCurrent, persisted };
    },
  };
}
