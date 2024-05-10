import { createDeferred } from '@onekeyfe/hd-shared';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { SearchDevice, Success, Unsuccessful } from '@onekeyfe/hd-core';
import type { Deferred } from '@onekeyfe/hd-shared';

const MAX_SEARCH_TRY_COUNT = 15;
const POLL_INTERVAL = 1000;
const POLL_INTERVAL_RATE = 1.5;

let searchPromise: Deferred<void> | null = null;
type IPollFn<T> = (time?: number, index?: number, rate?: number) => T;

export class DeviceScannerUtils {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  tryCount = 0;

  scanMap: Record<string, boolean> = {};

  searchIndex = 0;

  startDeviceScan(
    callback: (searchResponse: Unsuccessful | Success<SearchDevice[]>) => void,
    onSearchStateChange: (state: 'start' | 'stop') => void,
    pollIntervalRate = POLL_INTERVAL_RATE,
    pollInterval = POLL_INTERVAL,
    maxTryCount = MAX_SEARCH_TRY_COUNT,
  ) {
    const MaxTryCount = maxTryCount ?? MAX_SEARCH_TRY_COUNT;
    const searchDevices = async () => {
      // Should search Throttling
      if (searchPromise) {
        await searchPromise.promise;
        return;
      }

      searchPromise = createDeferred();
      onSearchStateChange('start');

      let searchResponse;
      try {
        searchResponse =
          await this.backgroundApi.serviceHardware.searchDevices();
      } finally {
        searchPromise?.resolve();
        searchPromise = null;
      }

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
      return new Promise((resolve: (p: void) => void) =>
        setTimeout(() => resolve(poll(time * rate, searchIndex, rate)), time),
      );
    };

    this.searchIndex += 1;
    this.scanMap[this.searchIndex] = true;
    const time = platformEnv.isNativeAndroid
      ? 2000
      : pollInterval ?? POLL_INTERVAL;
    const rate = pollIntervalRate ?? POLL_INTERVAL_RATE;
    poll(time, this.searchIndex, rate);
  }

  stopScan() {
    Object.keys(this.scanMap).forEach(
      (key: string) => (this.scanMap[key] = false),
    );
    this.tryCount = 0;
  }
}
