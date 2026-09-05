import platformEnv from '../platformEnv';

import controlStorage from './controlStorage';
import { RuntimeEnvironment } from './runtimeEnvironment';
import { getTravelModeRuntimeProfile } from './runtimeProfile';
import { TravelModeManager } from './TravelModeManager';

export const isTravelModeSupportedPlatform = platformEnv.isNative;

export const travelModeManager = new TravelModeManager(
  controlStorage,
  Boolean(isTravelModeSupportedPlatform),
);

export { getTravelModeRuntimeProfile };
export { RuntimeEnvironment };

export { setTravelModePushSuppressed } from './pushControl';

export type {
  ITravelModeControlRecord,
  ITravelModeControlStorage,
  ITravelModeRuntimeProfile,
  ITravelModeRuntimeState,
  IRuntimeCommandCapability,
  IRuntimeEffectCapability,
  IRuntimeEnvironment,
  IRuntimePersistenceCapability,
} from './types';
export {
  buildTravelModeCurrencyReferenceView,
  buildTravelModeManualLockPersistView,
  buildTravelModePasswordPersistView,
  buildTravelModeSettingsPersistView,
  mergeTravelModeManualLockPersistWrite,
  mergeTravelModePasswordPersistWrite,
  mergeTravelModeSettingsPersistWrite,
} from './persistencePolicy';
