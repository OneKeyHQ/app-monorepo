import { useEffect, useState } from 'react';

import { ONEKEY_HEALTH_CHECK_URL } from '@onekeyhq/shared/src/config/appConfig';

import { buildDeferredPromise } from './useDeferredPromise';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from './useVisibilityChange';

export interface IReachabilityConfiguration {
  reachabilityUrl: string;
  reachabilityTest?: (response: { status: number }) => Promise<boolean>;
  reachabilityMethod?: 'GET' | 'POST';
  reachabilityLongTimeout?: number;
  reachabilityShortTimeout?: number;
  reachabilityRequestTimeout?: number;
}

export interface IReachabilityState {
  isInternetReachable: boolean | null;
}

class NetInfo {
  state: IReachabilityState = {
    isInternetReachable: null,
  };

  prevIsInternetReachable = false;

  listeners: Array<(state: { isInternetReachable: boolean | null }) => void> =
    [];

  defer = buildDeferredPromise<unknown>();

  configuration = {
    reachabilityUrl: '',
    reachabilityMethod: 'GET',
    reachabilityTest: (response: { status: number }) =>
      Promise.resolve(response.status === 200),
    reachabilityLongTimeout: 60 * 1000,
    reachabilityShortTimeout: 5 * 1000,
    reachabilityRequestTimeout: 10 * 1000,
  };

  isFetching = false;

  pollingTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(configuration: IReachabilityConfiguration) {
    this.configure(configuration);

    const handleVisibilityChange = (isVisible: boolean) => {
      if (isVisible) {
        this.defer.resolve(undefined);
      } else {
        this.defer.reset();
      }
    };

    const isVisible = getCurrentVisibilityState();
    handleVisibilityChange(isVisible);
    onVisibilityStateChange(handleVisibilityChange);
  }

  configure(configuration: IReachabilityConfiguration) {
    this.configuration = {
      ...this.configuration,
      ...configuration,
    };
  }

  currentState() {
    return this.state;
  }

  updateState(state: { isInternetReachable: boolean | null }) {
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
    this.prevIsInternetReachable = !!state.isInternetReachable;
  }

  addEventListener(
    listener: (state: { isInternetReachable: boolean | null }) => void,
  ) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  async fetch() {
    if (this.isFetching) return;
    this.isFetching = true;
    await this.defer.promise;

    const {
      reachabilityRequestTimeout,
      reachabilityUrl,
      reachabilityMethod,
      reachabilityTest,
    } = this.configuration;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      reachabilityRequestTimeout,
    );

    try {
      const response = await fetch(reachabilityUrl, {
        method: reachabilityMethod,
        signal: controller.signal,
      });

      this.updateState({
        isInternetReachable: await reachabilityTest(response),
      });
    } catch (error) {
      console.error('Failed to fetch reachability:', error);
      this.updateState({ isInternetReachable: false });
    } finally {
      clearTimeout(timeoutId);
      this.isFetching = false;
      const { reachabilityShortTimeout, reachabilityLongTimeout } =
        this.configuration;
      this.pollingTimeoutId = setTimeout(
        () => {
          void this.fetch();
        },
        this.prevIsInternetReachable
          ? reachabilityLongTimeout
          : reachabilityShortTimeout,
      );
    }
  }

  async start() {
    void this.fetch();
  }

  async refresh() {
    if (this.pollingTimeoutId) {
      clearTimeout(this.pollingTimeoutId);
    }
    void this.fetch();
  }
}

export const globalNetInfo = new NetInfo({
  reachabilityUrl: ONEKEY_HEALTH_CHECK_URL,
});

export const configureNetInfo = (configuration: IReachabilityConfiguration) => {
  globalNetInfo.configure(configuration);
  void globalNetInfo.start();
};

export const refreshNetInfo = () => {
  void globalNetInfo.refresh();
};

export const useNetInfo = () => {
  const [reachabilityState, setReachabilityState] = useState<
    IReachabilityState & {
      isRawInternetReachable: boolean | null;
    }
  >(() => {
    const { isInternetReachable } = globalNetInfo.currentState();
    return {
      isInternetReachable: isInternetReachable ?? true,
      isRawInternetReachable: isInternetReachable,
    };
  });
  useEffect(() => {
    const remove = globalNetInfo.addEventListener(({ isInternetReachable }) => {
      setReachabilityState({
        isInternetReachable: isInternetReachable ?? true,
        isRawInternetReachable: isInternetReachable,
      });
    });
    return remove;
  }, []);
  return reachabilityState;
};
