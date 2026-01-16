import { analytics } from '@onekeyhq/shared/src/analytics';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  isLocalNetworkAddress,
  remoteLogger,
} from '@onekeyhq/shared/src/logger/remoteLogger';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import {
  devSettingsPersistAtom,
  firmwareUpdateDevSettingsPersistAtom,
} from '../states/jotai/atoms/devSettings';

import ServiceBase from './ServiceBase';

import type {
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
  }

  @backgroundMethod()
  public async switchDevMode(isOpen: boolean) {
    await devSettingsPersistAtom.set((prev) => ({
      enabled: isOpen,
      settings: isOpen ? prev.settings : {},
    }));
    void this.saveDevModeToSyncStorage();
  }

  @backgroundMethod()
  public async updateDevSetting(name: IDevSettingsKeys, value: any) {
    await devSettingsPersistAtom.set((prev) => ({
      enabled: true,
      settings: {
        ...prev.settings,
        [name]: value,
      },
    }));
    void this.saveDevModeToSyncStorage();
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

  @backgroundMethod()
  public async updateRemoteLogConfig(enabled: boolean, server?: string) {
    // Validate server address - only allow localhost and local network IPs
    if (server && !isLocalNetworkAddress(server)) {
      throw new OneKeyLocalError({
        message:
          'Invalid server address. Only localhost and local network IPs are allowed.',
      });
    }

    await devSettingsPersistAtom.set((prev) => ({
      enabled: true,
      settings: {
        ...prev.settings,
        remoteLogEnabled: enabled,
        ...(server !== undefined ? { remoteLogServer: server } : {}),
      },
    }));
    void this.saveDevModeToSyncStorage();

    // Update runtime remote logger
    if (enabled) {
      remoteLogger.enable(server);
    } else {
      remoteLogger.disable();
    }
  }

  @backgroundMethod()
  public async initRemoteLogger() {
    const { enabled, settings } = await this.getDevSetting();
    const shouldEnable =
      enabled && settings?.remoteLogEnabled && settings?.remoteLogServer;
    if (shouldEnable) {
      remoteLogger.enable(settings.remoteLogServer);
    }
  }
}

export default ServiceDevSetting;
