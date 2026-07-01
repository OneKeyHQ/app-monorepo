import { analytics } from '@onekeyhq/shared/src/analytics';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import nativeNetworkThrottle, {
  NATIVE_SLOW_4G_LATENCY_MS,
  setNetworkThrottleRuntimeConfig,
} from '@onekeyhq/shared/src/modules/NetworkThrottle';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { devSettingSyncStorage } from '@onekeyhq/shared/src/storage/instance/devSettingSyncStorageInstance';
import {
  EAppSyncStorageKeys,
  EDevSettingSyncStorageKeys,
} from '@onekeyhq/shared/src/storage/syncStorageKeys';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import {
  devSettingsPersistAtom,
  firmwareUpdateDevSettingsPersistAtom,
} from '../states/jotai/atoms/devSettings';

import ServiceBase from './ServiceBase';

import type {
  IDevSettings,
  IDevSettingsKeys,
  IDevSettingsPersistAtom,
  IFirmwareUpdateDevSettings,
  IFirmwareUpdateDevSettingsKeys,
} from '../states/jotai/atoms/devSettings';

@backgroundClass()
class ServiceDevSetting extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  async saveDevModeToSyncStorage() {
    const devSettings = await devSettingsPersistAtom.get();
    appStorage.syncStorage.set(
      EAppSyncStorageKeys.onekey_developer_mode_enabled,
      !!devSettings.enabled,
    );
    // Also write to the dedicated dev-setting MMKV instance for native code access
    devSettingSyncStorage.set(
      EDevSettingSyncStorageKeys.onekey_developer_mode_enabled,
      !!devSettings.enabled,
    );
    devSettingSyncStorage.set(
      EDevSettingSyncStorageKeys.onekey_native_network_throttle_enabled,
      !!devSettings.enabled &&
        !!devSettings.settings?.nativeNetworkThrottleEnabled,
    );
  }

  async syncCryptoSettings() {
    const devSettings = await devSettingsPersistAtom.get();
    appCrypto.pbkdf2.setPbkdf2NativeBackend(
      devSettings.enabled && devSettings.settings?.useFastPbkdf2NativeBackend
        ? 'react-native-fast-pbkdf2'
        : undefined,
    );
  }

  private async clearNetworkThrottleAfterDisableDevMode() {
    if (platformEnv.isDesktop) {
      const config =
        await globalThis.desktopApiProxy?.dev?.setNetworkThrottle?.({
          enabled: false,
          profile: 'slow4g',
        });
      if (config) {
        setNetworkThrottleRuntimeConfig({
          enabled: Boolean(config.enabled),
          profile: 'slow4g',
          latencyMs: NATIVE_SLOW_4G_LATENCY_MS,
        });
      } else {
        setNetworkThrottleRuntimeConfig({
          enabled: false,
          profile: 'slow4g',
          latencyMs: NATIVE_SLOW_4G_LATENCY_MS,
        });
      }
    }
    if (platformEnv.isNative) {
      const config = await nativeNetworkThrottle.setNetworkThrottle({
        enabled: false,
        profile: 'slow4g',
      });
      if (config.enabled) {
        throw new OneKeyLocalError('Failed to disable native network throttle');
      }
    }
  }

  @backgroundMethod()
  public async switchDevMode(isOpen: boolean) {
    if (isOpen) {
      await devSettingsPersistAtom.set((prev) => ({
        enabled: true,
        settings: prev.settings,
      }));
      await this.saveDevModeToSyncStorage();
      await this.syncCryptoSettings();
      return;
    }

    const previousDevSettings = await devSettingsPersistAtom.get();
    await devSettingsPersistAtom.set(() => ({
      enabled: false,
      settings: {},
    }));
    await this.saveDevModeToSyncStorage();
    await this.syncCryptoSettings();

    try {
      await this.clearNetworkThrottleAfterDisableDevMode();
    } catch (error) {
      await devSettingsPersistAtom.set(() => previousDevSettings);
      await this.saveDevModeToSyncStorage();
      await this.syncCryptoSettings();
      throw error;
    }
  }

  @backgroundMethod()
  public async updateDevSetting(
    name: IDevSettingsKeys,
    value: IDevSettings[IDevSettingsKeys],
  ): Promise<IDevSettings[IDevSettingsKeys] | boolean> {
    const previousDevSettings = await devSettingsPersistAtom.get();
    const updatePersistedDevSetting = async (
      nextValue: IDevSettings[IDevSettingsKeys],
    ) => {
      await devSettingsPersistAtom.set((prev) => ({
        enabled: true,
        settings: {
          ...prev.settings,
          [name]: nextValue,
        },
      }));
      await this.saveDevModeToSyncStorage();
      await this.syncCryptoSettings();
    };

    if (platformEnv.isDesktop && name === 'desktopNetworkThrottleEnabled') {
      try {
        await updatePersistedDevSetting(Boolean(value));
        const config =
          await globalThis.desktopApiProxy?.dev?.setNetworkThrottle?.({
            enabled: Boolean(value),
            profile: 'slow4g',
          });
        if (!config) {
          throw new OneKeyLocalError(
            'Failed to update desktop network throttle',
          );
        }
        const actualEnabled = Boolean(config.enabled);
        if (actualEnabled !== Boolean(value)) {
          await updatePersistedDevSetting(actualEnabled);
        }
        setNetworkThrottleRuntimeConfig({
          enabled: actualEnabled,
          profile: 'slow4g',
          latencyMs: NATIVE_SLOW_4G_LATENCY_MS,
        });
        return actualEnabled;
      } catch (error) {
        await devSettingsPersistAtom.set(() => previousDevSettings);
        await this.saveDevModeToSyncStorage();
        await this.syncCryptoSettings();
        await globalThis.desktopApiProxy?.dev
          ?.setNetworkThrottle?.({
            enabled:
              previousDevSettings.enabled &&
              !!previousDevSettings.settings?.desktopNetworkThrottleEnabled,
            profile: 'slow4g',
          })
          .catch(() => undefined);
        throw error;
      }
    }

    try {
      if (platformEnv.isNative && name === 'nativeNetworkThrottleEnabled') {
        await updatePersistedDevSetting(Boolean(value));
        const config = await nativeNetworkThrottle.setNetworkThrottle({
          enabled: Boolean(value),
          profile: 'slow4g',
        });
        if (config.enabled !== Boolean(value)) {
          throw new OneKeyLocalError(
            'Failed to update native network throttle',
          );
        }
        return config.enabled;
      }
    } catch (error) {
      await devSettingsPersistAtom.set(() => previousDevSettings);
      await this.saveDevModeToSyncStorage();
      await this.syncCryptoSettings();
      throw error;
    }

    await updatePersistedDevSetting(value);
    return value;
  }

  @backgroundMethod()
  public async getDevSetting(): Promise<IDevSettingsPersistAtom> {
    return devSettingsPersistAtom.get();
  }

  @backgroundMethod()
  public async getFirmwareUpdateDevSettings<
    T extends IFirmwareUpdateDevSettingsKeys,
  >(key: T): Promise<IFirmwareUpdateDevSettings[T] | undefined> {
    const dev = await devSettingsPersistAtom.get();
    if (!dev.enabled) {
      return undefined;
    }
    const fwDev = await firmwareUpdateDevSettingsPersistAtom.get();
    return fwDev[key];
  }

  @backgroundMethod()
  public async updateFirmwareUpdateDevSettings(
    values: Partial<IFirmwareUpdateDevSettings>,
  ) {
    await firmwareUpdateDevSettingsPersistAtom.set((prev) => ({
      ...prev,
      ...values,
    }));
  }

  @backgroundMethod()
  public async isSkipBundleGPGVerificationAllowed(): Promise<boolean> {
    // desktop keeps env-gated behavior in main process; native uses module API.
    // UI/background should use a unified capability check from BundleUpdate.
    return BundleUpdate.isSkipGpgVerificationAllowed().catch(() => false);
  }

  @backgroundMethod()
  public async setSkipBundleGPGVerification(enabled: boolean) {
    if (!(await this.isSkipBundleGPGVerificationAllowed())) {
      return;
    }
    devSettingSyncStorage.set(
      EDevSettingSyncStorageKeys.onekey_bundle_skip_gpg_verification,
      enabled,
    );
  }

  @backgroundMethod()
  public async getSkipBundleGPGVerification(): Promise<boolean> {
    if (!(await this.isSkipBundleGPGVerificationAllowed())) {
      return false;
    }
    return (
      devSettingSyncStorage.getBoolean(
        EDevSettingSyncStorageKeys.onekey_bundle_skip_gpg_verification,
      ) ?? false
    );
  }

  @backgroundMethod()
  public async initAnalytics() {
    const devSettings = await this.getDevSetting();
    const instanceId = await this.backgroundApi.serviceSetting.getInstanceId();
    analytics.init({
      instanceId,
      baseURL: buildServiceEndpoint({
        serviceName: EServiceEndpointEnum.Utility,
        env: devSettings.settings?.enableTestEndpoint ? 'test' : 'prod',
      }),
      enableAnalyticsInDev:
        devSettings.enabled && devSettings.settings?.enableAnalyticsRequest,
    });
  }
}

export default ServiceDevSetting;
