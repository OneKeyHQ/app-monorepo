import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { SearchDevice, Success, Unsuccessful } from '@onekeyfe/hd-core';

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
  resetSession?: boolean;
  waitForAllTransports?: boolean;
  transportType?: 'usb' | 'ble';
};
type IDeviceScannerBackgroundApi = {
  serviceHardware: {
    searchDevices: (params?: {
      vendor?: EHardwareVendor;
      resetSession?: boolean;
      waitForAllTransports?: boolean;
      transportType?: 'usb' | 'ble';
    }) => Promise<ISearchResponse>;
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
    let shouldResetSession = options?.resetSession ?? false;
    const searchDevices = async () => {
      const currentSearchTask = this.currentSearchTask;
      if (currentSearchTask) {
        const sharedSearchResponse = await currentSearchTask;
        shouldResetSession = false;
        callback(sharedSearchResponse);
        this.tryCount += 1;
        return sharedSearchResponse;
      }

      onSearchStateChange('start');

      const searchTask = this.backgroundApi.serviceHardware
        .searchDevices(
          vendor || shouldResetSession
            ? {
                vendor,
                resetSession: shouldResetSession,
                waitForAllTransports: options?.waitForAllTransports,
                transportType: options?.transportType,
              }
            : undefined,
        )
        .finally(() => {
          if (this.currentSearchTask === searchTask) {
            this.currentSearchTask = null;
          }
        });
      this.currentSearchTask = searchTask;

      const searchResponse = await searchTask;
      shouldResetSession = false;

      callback(searchResponse);

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

      await searchDevices();
      const nextTime = isThirdPartyVendor
        ? Math.min(time * rate, MAX_POLL_INTERVAL)
        : time * rate;
      return new Promise((resolve: (p: void) => void) =>
        setTimeout(() => resolve(poll(nextTime, searchIndex, rate)), time),
      );
    };

    this.searchIndex += 1;
    this.scanMap[this.searchIndex] = true;
    const time = platformEnv.isNativeAndroid
      ? 2000
      : (pollInterval ?? POLL_INTERVAL);
    const rate = pollIntervalRate ?? POLL_INTERVAL_RATE;
    poll(time, this.searchIndex, rate);
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
    // Stop scanning first
    this.stopScan();
    // Wait for any ongoing search to complete
    await this.waitForCurrentSearchToComplete();
  }
}
