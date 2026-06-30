import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { shouldSuppressNetworkErrorToast } from './offlineNetworkToastGuard';

type IShowToastPayload = IAppEventBusPayload[EAppEventBusNames.ShowToast];

const createErrorToastPayload = (
  payload: Partial<IShowToastPayload>,
): IShowToastPayload => ({
  method: 'error',
  title: 'Error',
  ...payload,
});

describe('offlineNetworkToastGuard', () => {
  it('suppresses axios network error toast when offline is already confirmed', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: false,
        payload: createErrorToastPayload({
          errorClassName: EOneKeyErrorClassNames.AxiosNetworkError,
          title: 'Network error',
        }),
      }),
    ).toBe(true);
  });

  it('suppresses transport timeout code regardless of network status', () => {
    const payload = createErrorToastPayload({
      errorCode: 'ECONNABORTED',
      errorName: 'AxiosError',
      title: 'timeout of 30000ms exceeded',
    });

    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: false,
        payload,
      }),
    ).toBe(true);

    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: true,
        payload,
      }),
    ).toBe(true);

    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: null,
        payload,
      }),
    ).toBe(true);
  });

  it('suppresses axios timeout text without an HTTP status code', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: true,
        payload: createErrorToastPayload({
          errorName: 'AxiosError',
          title: 'timeout of 30000ms exceeded',
        }),
      }),
    ).toBe(true);
  });

  it('keeps generic timeout errors visible', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: true,
        payload: createErrorToastPayload({
          title: 'Device method call timeout',
        }),
      }),
    ).toBe(false);
  });

  it('keeps server timeout responses visible without a transport timeout code', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: true,
        payload: createErrorToastPayload({
          errorName: 'AxiosError',
          httpStatusCode: 504,
          title: 'Gateway Timeout',
        }),
      }),
    ).toBe(false);
  });

  it('suppresses server timeout responses with a transport timeout code', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: true,
        payload: createErrorToastPayload({
          errorCode: 'ETIMEDOUT',
          errorName: 'AxiosError',
          httpStatusCode: 408,
          title: 'Request timeout',
        }),
      }),
    ).toBe(true);
  });

  it('keeps server and business errors visible while offline', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: false,
        payload: createErrorToastPayload({
          errorClassName: EOneKeyErrorClassNames.OneKeyServerApiError,
          httpStatusCode: 400,
          title: 'Invalid request',
        }),
      }),
    ).toBe(false);
  });

  it('keeps non-error toast methods visible while offline', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: false,
        payload: {
          method: 'warning',
          title: 'Warning',
        },
      }),
    ).toBe(false);
  });
});
