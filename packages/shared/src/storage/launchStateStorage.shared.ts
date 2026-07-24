export const APP_LAUNCH_STATE_STORAGE_KEY = 'ONEKEY_APP_LAUNCH_STATE_V1';

const APP_LAUNCH_STATE_SCHEMA_VERSION = 1;

export type IAppLaunchState = {
  firstLaunchAt: number;
  installationTime?: number;
  onboardingCompleted: boolean;
  schemaVersion: typeof APP_LAUNCH_STATE_SCHEMA_VERSION;
};

export type IAppLaunchStateStorageBackend = {
  getItem: (key: string) => string | undefined;
  setItem: (key: string, value: string) => void;
};

export type IAppLaunchStateStatus =
  | 'completed'
  | 'legacyUnknown'
  | 'onboardingPending';

export type IAppInstallationClassification =
  | 'existingState'
  | 'freshInstall'
  | 'unknown';

export type IAppInstallationReconcileResult = {
  classification: IAppInstallationClassification;
  installationTime?: number;
};

function parseAppLaunchState(raw: string | undefined) {
  if (!raw) {
    return undefined;
  }
  try {
    const value = JSON.parse(raw) as Partial<IAppLaunchState>;
    if (
      value.schemaVersion !== APP_LAUNCH_STATE_SCHEMA_VERSION ||
      typeof value.firstLaunchAt !== 'number' ||
      typeof value.onboardingCompleted !== 'boolean' ||
      (value.installationTime !== undefined &&
        typeof value.installationTime !== 'number')
    ) {
      return undefined;
    }
    return value as IAppLaunchState;
  } catch {
    return undefined;
  }
}

export function createAppLaunchStateStorage(
  backend: IAppLaunchStateStorageBackend,
) {
  const read = () =>
    parseAppLaunchState(backend.getItem(APP_LAUNCH_STATE_STORAGE_KEY));

  const write = (state: IAppLaunchState) => {
    backend.setItem(APP_LAUNCH_STATE_STORAGE_KEY, JSON.stringify(state));
    return state;
  };

  return {
    read,
    getStatus(): IAppLaunchStateStatus {
      const current = read();
      if (!current) {
        return 'legacyUnknown';
      }
      return current.onboardingCompleted ? 'completed' : 'onboardingPending';
    },
    markOnboardingCompleted(installationTime?: number) {
      const current = read();
      const resolvedInstallationTime =
        installationTime ?? current?.installationTime;
      return write({
        firstLaunchAt: current?.firstLaunchAt ?? Date.now(),
        ...(resolvedInstallationTime !== undefined
          ? { installationTime: resolvedInstallationTime }
          : undefined),
        onboardingCompleted: true,
        schemaVersion: APP_LAUNCH_STATE_SCHEMA_VERSION,
      });
    },
    markOnboardingPending(installationTime?: number) {
      const current = read();
      const resolvedInstallationTime =
        installationTime ?? current?.installationTime;
      return write({
        firstLaunchAt: current?.firstLaunchAt ?? Date.now(),
        ...(resolvedInstallationTime !== undefined
          ? { installationTime: resolvedInstallationTime }
          : undefined),
        onboardingCompleted: false,
        schemaVersion: APP_LAUNCH_STATE_SCHEMA_VERSION,
      });
    },
    markFreshInstallationPending(installationTime: number) {
      return write({
        firstLaunchAt: Date.now(),
        installationTime,
        onboardingCompleted: false,
        schemaVersion: APP_LAUNCH_STATE_SCHEMA_VERSION,
      });
    },
    setInstallationTime(installationTime: number) {
      const current =
        read() ??
        ({
          firstLaunchAt: Date.now(),
          onboardingCompleted: false,
          schemaVersion: APP_LAUNCH_STATE_SCHEMA_VERSION,
        } satisfies IAppLaunchState);
      return write({
        ...current,
        installationTime,
      });
    },
  };
}
