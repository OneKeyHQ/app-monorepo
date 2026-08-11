import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { convertDeviceError } from '../errors/utils/deviceErrorUtils';

import type { SearchDevice, Success, Unsuccessful } from '@onekeyfe/hd-core';
import type { HardwareConnectProtocol } from '@onekeyfe/hd-shared';

// Scan polls before auto-stop (all vendors); ~85s window for third-party.
const MAX_SEARCH_TRY_COUNT = 20;
const POLL_INTERVAL = 1000;
const POLL_INTERVAL_RATE = 1.5;
// Third-party (Trezor/Ledger) backoff cap; OneKey keeps its unbounded backoff.
// 5s, not lower: Ledger re-scans via DMK each poll (Trezor is a cheap snapshot).
const MAX_POLL_INTERVAL = 5000;

type ISearchResponse = Unsuccessful | Success<SearchDevice[]>;
type IPollFn<T> = (time?: number, index?: number, rate?: number) => T;
type IDeviceScanOptions = {
  /** @deprecated Discovery always detects the protocol from an active response. */
  connectProtocol?: HardwareConnectProtocol;
  resetSession?: boolean;
  waitForAllTransports?: boolean;
  transportType?: 'usb' | 'ble';
  onError?: (error: Error) => void;
};
type IDeviceScannerBackgroundApi = {
  serviceHardware: {
    searchDevices: (params?: {
      vendor?: EHardwareVendor;
      resetSession?: boolean;
      waitForAllTransports?: boolean;
      transportType?: 'usb' | 'ble';
      connectProtocol?: HardwareConnectProtocol;
    }) => Promise<ISearchResponse>;
    stopDeviceScan?: () => Promise<void>;
  };
};

export class DeviceScannerUtils {
  constructor({
    backgroundApi,
  }: {
    backgroundApi: IDeviceScannerBackgroundApi;
  }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IDeviceScannerBackgroundApi;

  tryCount = 0;

  scanMap: Record<string, boolean> = {};

  searchIndex = 0;

  currentSearchTask: Promise<ISearchResponse> | null = null;

  currentSearchIdentity: string | null = null;

  currentSearchOwnerIndex: number | null = null;

  startDeviceScan(
    callback: (searchResponse: Unsuccessful | Success<SearchDevice[]>) => void,
    onSearchStateChange: (state: 'start' | 'stop') => void,
    pollIntervalRate = POLL_INTERVAL_RATE,
    pollInterval = POLL_INTERVAL,
    maxTryCount = MAX_SEARCH_TRY_COUNT,
    vendor?: EHardwareVendor,
    options?: IDeviceScanOptions,
  ) {
    const MaxTryCount = maxTryCount ?? MAX_SEARCH_TRY_COUNT;
    const isThirdPartyVendor = getVendorProfile(vendor).isThirdParty;
    this.searchIndex += 1;
    const scanIndex = this.searchIndex;
    this.scanMap[scanIndex] = true;
    const searchIdentity = JSON.stringify({
      vendor,
      waitForAllTransports: options?.waitForAllTransports,
      transportType: options?.transportType,
    });
    let shouldResetSession = options?.resetSession ?? false;
    const reportError = (error: unknown) => {
      const normalizedError =
        error instanceof Error
          ? error
          : Object.assign(
              new Error(
                typeof (error as { message?: unknown })?.message === 'string'
                  ? (error as { message: string }).message
                  : String(error),
              ),
              typeof error === 'object' && error !== null ? error : {},
            );
      try {
        if (options?.onError) {
          options.onError(normalizedError);
        } else {
          console.error('Device scan failed:', normalizedError);
        }
      } catch (handlerError) {
        console.error('Device scan error handler failed:', handlerError);
      }
    };
    const deliverSearchResponse = (searchResponse: ISearchResponse) => {
      if (!searchResponse.success && options?.onError) {
        reportError(
          convertDeviceError(searchResponse.payload, {
            vendor,
          }),
        );
        return;
      }
      callback(searchResponse);
    };
    const searchDevices = async () => {
      const currentSearchTask = this.currentSearchTask;
      if (currentSearchTask) {
        const currentSearchIdentity = this.currentSearchIdentity;
        const currentSearchOwnerIndex = this.currentSearchOwnerIndex;
        const shouldStartOwnSearch = () =>
          this.scanMap[scanIndex] &&
          (currentSearchIdentity !== searchIdentity ||
            (currentSearchOwnerIndex !== null &&
              !this.scanMap[currentSearchOwnerIndex]));
        let sharedSearchResponse: ISearchResponse;
        try {
          sharedSearchResponse = await currentSearchTask;
        } catch (error) {
          if (shouldStartOwnSearch()) {
            return searchDevices();
          }
          throw error;
        }
        if (!this.scanMap[scanIndex]) {
          return sharedSearchResponse;
        }
        if (shouldStartOwnSearch()) {
          return searchDevices();
        }
        shouldResetSession = false;
        deliverSearchResponse(sharedSearchResponse);
        this.tryCount += 1;
        return sharedSearchResponse;
      }

      onSearchStateChange('start');

      let searchParams:
        | {
            resetSession?: boolean;
            transportType?: 'usb' | 'ble';
            vendor?: EHardwareVendor;
            waitForAllTransports?: boolean;
          }
        | undefined;
      if (
        vendor ||
        shouldResetSession ||
        options?.waitForAllTransports !== undefined ||
        options?.transportType
      ) {
        searchParams = {
          vendor,
          resetSession: shouldResetSession,
          waitForAllTransports: options?.waitForAllTransports,
          transportType: options?.transportType,
        };
      }

      const searchTask = this.backgroundApi.serviceHardware
        .searchDevices(searchParams)
        .finally(() => {
          if (this.currentSearchTask === searchTask) {
            this.currentSearchTask = null;
            this.currentSearchIdentity = null;
            this.currentSearchOwnerIndex = null;
          }
        });
      this.currentSearchTask = searchTask;
      this.currentSearchIdentity = searchIdentity;
      this.currentSearchOwnerIndex = scanIndex;

      const searchResponse = await searchTask;
      shouldResetSession = false;

      if (!this.scanMap[scanIndex]) {
        return searchResponse;
      }
      deliverSearchResponse(searchResponse);

      this.tryCount += 1;
      onSearchStateChange('stop');
      return searchResponse;
    };

    const poll: IPollFn<void> = async (
      time = POLL_INTERVAL,
      searchIndex = 0,
      rate = POLL_INTERVAL_RATE,
    ) => {
      if (!this.scanMap[searchIndex]) {
        return;
      }
      if (this.tryCount > MaxTryCount) {
        this.stopScan();
        return;
      }

      try {
        await searchDevices();
      } catch (error) {
        if (!this.scanMap[searchIndex]) {
          return;
        }
        reportError(error);
        this.stopScan();
        onSearchStateChange('stop');
        return;
      }
      const nextTime = isThirdPartyVendor
        ? Math.min(time * rate, MAX_POLL_INTERVAL)
        : time * rate;
      return new Promise((resolve: (p: void) => void) =>
        setTimeout(() => resolve(poll(nextTime, searchIndex, rate)), time),
      );
    };

    const time = platformEnv.isNativeAndroid
      ? 2000
      : (pollInterval ?? POLL_INTERVAL);
    const rate = pollIntervalRate ?? POLL_INTERVAL_RATE;
    poll(time, scanIndex, rate);
  }

  stopScan() {
    Object.keys(this.scanMap).forEach(
      (key: string) => (this.scanMap[key] = false),
    );
    this.tryCount = 0;
  }

  async waitForCurrentSearchToComplete() {
    if (this.currentSearchTask) {
      await Promise.allSettled([this.currentSearchTask]);
    }
  }

  async stopScanAndWait() {
    // 先停止轮询并等待当前枚举任务收尾，再等待 Electron Noble 确认
    // stopScanning 完成，避免紧随其后的 connect 与旧扫描互相干扰。
    this.stopScan();
    await this.waitForCurrentSearchToComplete();
    await this.backgroundApi.serviceHardware.stopDeviceScan?.();
  }
}
