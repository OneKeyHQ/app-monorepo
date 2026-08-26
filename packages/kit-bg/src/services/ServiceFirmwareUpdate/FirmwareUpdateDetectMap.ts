import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IBleFirmwareUpdateInfo,
  IFirmwareUpdateDetectStatus,
  IFirmwareUpdateDetectStatusSnapshot,
  IFirmwareUpdateInfo,
  IFirmwareUpdatesDetectMap,
  IFirmwareUpdatesDetectStatus,
} from '@onekeyhq/shared/types/device';

import { firmwareUpdatesDetectStatusPersistAtom } from '../../states/jotai/atoms';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

export class FirmwareUpdateDetectMap {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    this.backgroundApi = backgroundApi;
    this.firstDetectAt = Date.now();
  }

  firstDetectAt: number;

  backgroundApi: IBackgroundApi;

  detectMapCache: IFirmwareUpdatesDetectMap = {};

  detectTimeSpan = timerUtils.getTimeDurationMs({ minute: 5 });

  firstDetectTimeSpan = timerUtils.getTimeDurationMs({ minute: 1 });

  getNextDetectDelay({ connectId }: { connectId: string }) {
    const now = Date.now();
    const firstDetectDelay =
      this.firstDetectTimeSpan - (now - this.firstDetectAt);
    const lastDetectAt = this.detectMapCache[connectId]?.lastDetectAt;
    const repeatedDetectDelay = lastDetectAt
      ? this.detectTimeSpan - (now - lastDetectAt)
      : 0;

    return Math.max(0, firstDetectDelay, repeatedDetectDelay);
  }

  shouldDetect({ connectId }: { connectId: string }) {
    const now = Date.now();

    // Check is not allowed until one minute after the app is started
    if (now - this.firstDetectAt < this.firstDetectTimeSpan) {
      // console.log(`skip detectFirmwareUpdates with first check: ${connectId}`);

      void this.backgroundApi.serviceFirmwareUpdate.showAutoUpdateCheckDebugToast(
        '刚启动 App，跳过检查更新',
      );

      return false;
    }

    const lastDetectResult = this.detectMapCache[connectId];
    if (
      lastDetectResult?.lastDetectAt &&
      now - lastDetectResult.lastDetectAt < this.detectTimeSpan
    ) {
      // console.log(`skip detectFirmwareUpdates: ${connectId}`);

      void this.backgroundApi.serviceFirmwareUpdate.showAutoUpdateCheckDebugToast(
        '刚刚检查过，跳过检查更新',
      );
      return false;
    }

    void this.backgroundApi.serviceFirmwareUpdate.showAutoUpdateCheckDebugToast(
      '开始检查更新',
    );
    return true;
  }

  updateLastDetectAt({ connectId }: { connectId: string }) {
    this.detectMapCache[connectId] = {
      ...this.detectMapCache[connectId],
      lastDetectAt: Date.now(),
    };
  }

  updateLastDetectAtWithDelay({
    connectId,
    delay,
  }: {
    connectId: string;
    delay: number;
  }) {
    this.detectMapCache[connectId] = {
      ...this.detectMapCache[connectId],
      lastDetectAt: Date.now() + delay,
    };
  }

  resetLastDetectAt({ connectId }: { connectId: string }) {
    this.detectMapCache[connectId] = {
      ...this.detectMapCache[connectId],
      lastDetectAt: 0,
    };
  }

  private normalizeConnectIds(connectIds: string[]) {
    const seen = new Set<string>();
    return connectIds.filter((connectId) => {
      const normalized = connectId.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }

  private findDetectCache(connectIds: string[]) {
    const normalizedConnectIds = new Set(
      connectIds.map((connectId) => connectId.toLowerCase()),
    );
    const matchingCaches = Object.entries(this.detectMapCache).flatMap(
      ([cacheConnectId, cache]) =>
        cache && normalizedConnectIds.has(cacheConnectId.toLowerCase())
          ? [cache]
          : [],
    );
    return (
      matchingCaches.find((cache) => cache.updateInfo) ?? matchingCaches[0]
    );
  }

  private prepareCanonicalDetectCache({
    connectId,
    connectIds = [connectId],
  }: {
    connectId: string;
    connectIds?: string[];
  }) {
    const aliases = this.normalizeConnectIds([connectId, ...connectIds]);
    const canonicalCache = this.detectMapCache[connectId]
      ? {
          ...this.detectMapCache[connectId],
          updateInfo: this.detectMapCache[connectId]?.updateInfo
            ? { ...this.detectMapCache[connectId]?.updateInfo }
            : undefined,
        }
      : undefined;
    const normalizedAliases = new Set(
      aliases.map((alias) => alias.toLowerCase()),
    );
    for (const [cacheConnectId, cache] of Object.entries(this.detectMapCache)) {
      if (cache && normalizedAliases.has(cacheConnectId.toLowerCase())) {
        cache.updateInfo = undefined;
        cache.detectResultResolved = true;
      }
    }
    return { aliases, canonicalCache };
  }

  private buildDetectStatus({
    connectId,
    detectCache,
  }: {
    connectId: string;
    detectCache: IFirmwareUpdatesDetectMap[string];
  }): IFirmwareUpdateDetectStatus | undefined {
    const updateInfo = detectCache?.updateInfo;
    if (!updateInfo) {
      return undefined;
    }
    return {
      connectId,
      hasUpgrade: Boolean(
        updateInfo.hasUpgrade ??
        (updateInfo.firmware?.hasUpgrade || updateInfo.ble?.hasUpgrade),
      ),
      toVersion: updateInfo.firmware?.hasUpgrade
        ? updateInfo.firmware.toVersion
        : undefined,
      toFirmwareType: updateInfo.firmware?.hasUpgrade
        ? updateInfo.firmware.toFirmwareType
        : undefined,
      toVersionBle: updateInfo.ble?.hasUpgrade
        ? updateInfo.ble.toVersion
        : undefined,
    };
  }

  getDetectStatus({
    connectId,
    connectIds = [connectId],
  }: {
    connectId: string;
    connectIds?: string[];
  }): IFirmwareUpdateDetectStatusSnapshot {
    const aliases = this.normalizeConnectIds([connectId, ...connectIds]);
    const detectCache = this.findDetectCache(aliases);
    return {
      requestedConnectId: connectId,
      resolved: detectCache?.detectResultResolved === true,
      connectIds: aliases,
      status: this.buildDetectStatus({ connectId, detectCache }),
    };
  }

  async updateDetectStatusAtom({
    connectId,
    connectIds = [connectId],
  }: {
    connectId: string;
    connectIds?: string[];
  }) {
    const aliases = this.normalizeConnectIds([connectId, ...connectIds]);
    const detectCache = this.findDetectCache(aliases);
    if (detectCache?.detectResultResolved !== true) {
      return;
    }
    await firmwareUpdatesDetectStatusPersistAtom.set(
      (value: IFirmwareUpdatesDetectStatus | undefined) => {
        const status = this.buildDetectStatus({ connectId, detectCache });
        const newValue = { ...value };
        for (const alias of aliases) {
          if (status) {
            newValue[alias] = { ...status, connectId: alias };
          } else {
            delete newValue[alias];
          }
        }
        return Object.keys(newValue).length ? newValue : undefined;
      },
    );
    appEventBus.emit(EAppEventBusNames.FirmwareUpdateDetectStatusChanged, {
      connectIds: aliases,
    });
  }

  async updateFirmwareUpdateInfo({
    connectId,
    connectIds,
    updateInfo,
  }: {
    connectId: string;
    connectIds?: string[];
    updateInfo: IFirmwareUpdateInfo;
  }) {
    // console.log('updateFirmwareUpdateInfo', { connectId, updateInfo });
    const mockAllIsUpToDate =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'allIsUpToDate',
      );
    const { aliases, canonicalCache } = this.prepareCanonicalDetectCache({
      connectId,
      connectIds,
    });
    if (!mockAllIsUpToDate) {
      this.detectMapCache[connectId] = {
        ...canonicalCache,
        detectResultResolved: true,
        updateInfo: {
          ...canonicalCache?.updateInfo,
          firmware: updateInfo,
        },
      };
    } else {
      this.detectMapCache[connectId] = {
        ...canonicalCache,
        detectResultResolved: true,
        updateInfo: undefined,
      };
    }
    await this.updateDetectStatusAtom({
      connectId,
      connectIds: aliases,
    });
  }

  async updateBleFirmwareUpdateInfo({
    connectId,
    connectIds,
    updateInfo,
  }: {
    connectId: string;
    connectIds?: string[];
    updateInfo: IBleFirmwareUpdateInfo;
  }) {
    const mockAllIsUpToDate =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'allIsUpToDate',
      );
    const { aliases, canonicalCache } = this.prepareCanonicalDetectCache({
      connectId,
      connectIds,
    });
    if (!mockAllIsUpToDate) {
      this.detectMapCache[connectId] = {
        ...canonicalCache,
        detectResultResolved: true,
        updateInfo: {
          ...canonicalCache?.updateInfo,
          ble: updateInfo,
        },
      };
    } else {
      this.detectMapCache[connectId] = {
        ...canonicalCache,
        detectResultResolved: true,
        updateInfo: undefined,
      };
    }
    await this.updateDetectStatusAtom({
      connectId,
      connectIds: aliases,
    });
  }

  async resolveUpdateInfo({
    connectId,
    connectIds,
    hasUpgrade,
    firmware,
    ble,
  }: {
    connectId: string;
    connectIds?: string[];
    hasUpgrade: boolean;
    firmware?: IFirmwareUpdateInfo;
    ble?: IBleFirmwareUpdateInfo;
  }) {
    const { aliases, canonicalCache } = this.prepareCanonicalDetectCache({
      connectId,
      connectIds,
    });
    this.detectMapCache[connectId] = {
      ...canonicalCache,
      detectResultResolved: true,
      updateInfo: hasUpgrade
        ? {
            hasUpgrade,
            firmware,
            ble,
          }
        : undefined,
    };
    await this.updateDetectStatusAtom({ connectId, connectIds: aliases });
  }

  async deleteUpdateInfo({
    connectId,
    connectIds = [connectId],
  }: {
    connectId: string;
    connectIds?: string[];
  }) {
    const { aliases, canonicalCache } = this.prepareCanonicalDetectCache({
      connectId,
      connectIds,
    });
    this.detectMapCache[connectId] = {
      ...canonicalCache,
      detectResultResolved: true,
      updateInfo: undefined,
    };
    await this.updateDetectStatusAtom({
      connectId,
      connectIds: aliases,
    });
  }

  async clear() {
    this.detectMapCache = {};
    await firmwareUpdatesDetectStatusPersistAtom.set(undefined);
    appEventBus.emit(EAppEventBusNames.FirmwareUpdateDetectStatusChanged, {
      connectIds: [],
    });
  }
}
