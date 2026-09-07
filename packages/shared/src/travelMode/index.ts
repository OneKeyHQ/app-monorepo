import { OneKeyLocalError } from '../errors';
import platformEnv from '../platformEnv';

import controlStorage from './controlStorage';
import { RuntimeEnvironment } from './runtimeEnvironment';
import { getTravelModeRuntimeProfile } from './runtimeProfile';

import type { TravelModeManager } from './TravelModeManager';

type ITravelModeManager = Pick<TravelModeManager, keyof TravelModeManager>;

export const isTravelModeSupportedPlatform = platformEnv.isNative;

function createTravelModeManager(): ITravelModeManager {
  if (platformEnv.isNative) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TravelModeManager: NativeTravelModeManager } =
      require('./TravelModeManager') as typeof import('./TravelModeManager');
    return new NativeTravelModeManager(controlStorage, true);
  }

  const environment = RuntimeEnvironment.create(
    getTravelModeRuntimeProfile(false),
  );
  return {
    ready: Promise.resolve(),
    isMaskingDataSync: () => false,
    async isActive() {
      return false;
    },
    async getRuntimeState() {
      return 'inactive';
    },
    async getRuntimeProfile() {
      return environment.profile;
    },
    getRuntimeEnvironmentSync: () => environment,
    async getRuntimeEnvironment() {
      return environment;
    },
    async getPersistedEnabled() {
      return false;
    },
    async getBootstrapControlValue() {
      return undefined;
    },
    async getVerifyString() {
      throw new OneKeyLocalError(
        'Travel Mode passcode verifier is unavailable',
      );
    },
    async transition() {
      throw new OneKeyLocalError('Travel Mode is only supported on mobile');
    },
    markRestartFailed() {},
    getInitializationErrorForDiagnostics: () => undefined,
  };
}

export const travelModeManager = createTravelModeManager();

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
