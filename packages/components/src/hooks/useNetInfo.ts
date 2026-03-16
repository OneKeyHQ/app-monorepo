import { useEffect, useState } from 'react';

import { ONEKEY_HEALTH_CHECK_URL } from '@onekeyhq/shared/src/config/appConfig';
import { healthCheckRequest } from '@onekeyhq/shared/src/request/helpers/healthCheckRequest';

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

  pendingRefresh = false;

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

    try {
      const response = await healthCheckRequest({
        url: reachabilityUrl,
        method: reachabilityMethod as 'GET' | 'POST',
        timeout: reachabilityRequestTimeout,
      });

      this.updateState({
        isInternetReachable: await reachabilityTest(response),
      });
    } catch (error) {
      console.error('Failed to fetch reachability:', error);
      this.updateState({ isInternetReachable: false });
    } finally {
      this.isFetching = false;
      this.clearPolling();
      const { reachabilityShortTimeout, reachabilityLongTimeout } =
        this.configuration;
      if (this.pendingRefresh) {
        this.pendingRefresh = false;
        this.pollingTimeoutId = setTimeout(() => {
          void this.fetch();
        }, reachabilityShortTimeout);
      } else {
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
  }

  isIdle() {
    return !this.pollingTimeoutId && !this.isFetching && !this.pendingRefresh;
  }

  private clearPolling() {
    if (this.pollingTimeoutId) {
      clearTimeout(this.pollingTimeoutId);
      this.pollingTimeoutId = null;
    }
  }

  private triggerFetch(clearPending: boolean) {
    this.clearPolling();
    if (this.isFetching) {
      this.pendingRefresh = true;
      return;
    }
    if (clearPending) {
      this.pendingRefresh = false;
    }
    void this.fetch();
  }

  start() {
    this.triggerFetch(true);
  }

  refresh() {
    this.triggerFetch(false);
  }
}

export const globalNetInfo = new NetInfo({
  reachabilityUrl: ONEKEY_HEALTH_CHECK_URL,
});

export const configureNetInfo = (configuration: IReachabilityConfiguration) => {
  const urlChanged =
    globalNetInfo.configuration.reachabilityUrl !==
    configuration.reachabilityUrl;
  globalNetInfo.configure(configuration);
  if (urlChanged || globalNetInfo.isIdle()) {
    globalNetInfo.start();
  }
};

export const refreshNetInfo = () => {
  globalNetInfo.refresh();
};

const buildReachabilityState = (
  isInternetReachable: boolean | null,
): IReachabilityState & {
  isRawInternetReachable: boolean | null;
} => ({
  isInternetReachable: isInternetReachable ?? true,
  isRawInternetReachable: isInternetReachable,
});

const mergeReachabilityState = (
  prevState: IReachabilityState & {
    isRawInternetReachable: boolean | null;
  },
  nextState: IReachabilityState & {
    isRawInternetReachable: boolean | null;
  },
) => {
  if (
    prevState.isInternetReachable === nextState.isInternetReachable &&
    prevState.isRawInternetReachable === nextState.isRawInternetReachable
  ) {
    return prevState;
  }

  return nextState;
};

export const useNetInfo = (enabled = true) => {
  const [reachabilityState, setReachabilityState] = useState<
    IReachabilityState & {
      isRawInternetReachable: boolean | null;
    }
  >(() => {
    const { isInternetReachable } = globalNetInfo.currentState();
    return buildReachabilityState(isInternetReachable);
  });

  useEffect(() => {
    const { isInternetReachable } = globalNetInfo.currentState();
    setReachabilityState((prevState) =>
      mergeReachabilityState(
        prevState,
        buildReachabilityState(isInternetReachable),
      ),
    );

    if (!enabled) {
      return undefined;
    }

    const remove = globalNetInfo.addEventListener(
      ({ isInternetReachable: nextInternetReachable }) => {
        setReachabilityState((prevState) =>
          mergeReachabilityState(
            prevState,
            buildReachabilityState(nextInternetReachable),
          ),
        );
      },
    );
    return remove;
  }, [enabled]);

  return reachabilityState;
};
