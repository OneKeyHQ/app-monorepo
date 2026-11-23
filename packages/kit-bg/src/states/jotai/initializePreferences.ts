import { isNil } from 'lodash';

import { EAtomNames } from './atomNames';
import { buildJotaiStorageKey, onekeyJotaiStorage } from './jotaiStorage';

import type { IPerpsCustomSettings } from './atoms/perps';

// Called before generic atom hydration, using the pre-initialization snapshot.
export async function initializePreferences(
  storage: Map<string, unknown>,
  isRestoredClient = false,
) {
  const perpsKey = buildJotaiStorageKey(EAtomNames.perpsCustomSettingsAtom);
  const settingsKey = buildJotaiStorageKey(EAtomNames.settingsPersistAtom);
  // Only fresh/reset clients start in Easy mode. Preserve upgrades and choices.
  if (
    !isRestoredClient &&
    isNil(storage.get(settingsKey)) &&
    isNil(storage.get(perpsKey))
  ) {
    const preferences: Partial<IPerpsCustomSettings> = {
      mobileTradingMode: 'simple',
    };
    await onekeyJotaiStorage.setItem(perpsKey, preferences);
    storage.set(perpsKey, preferences);
  }
}
