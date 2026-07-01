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

  it('suppresses axios network error toast before offline status is confirmed', () => {
    const payload = createErrorToastPayload({
      errorClassName: EOneKeyErrorClassNames.AxiosNetworkError,
      title: '网络错误',
    });

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

  it('suppresses exact network error text before offline status is confirmed', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: true,
        payload: createErrorToastPayload({
          title: '网络错误',
        }),
      }),
    ).toBe(true);

    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: true,
        payload: createErrorToastPayload({
          title: 'Network Error',
        }),
      }),
    ).toBe(true);
  });

  it('suppresses ERR_NETWORK before offline status is confirmed', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: true,
        payload: createErrorToastPayload({
          errorCode: 'ERR_NETWORK',
          title: 'Request failed',
        }),
      }),
    ).toBe(true);
  });

  it('keeps broader network failure text tied to the offline state', () => {
    const payload = createErrorToastPayload({
      title: 'Network request failed',
    });

    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: true,
        payload,
      }),
    ).toBe(false);

    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: false,
        payload,
      }),
    ).toBe(true);
  });

  it('suppresses transport timeout code only after offline is confirmed', () => {
    const payload = createErrorToastPayload({
      errorCode: 'ECONNABORTED',
      errorName: 'AxiosError',
      title: 'Request timeout',
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
    ).toBe(false);

    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: null,
        payload,
      }),
    ).toBe(false);
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

  it('suppresses exact 30000ms timeout text without transport metadata', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: false,
        payload: createErrorToastPayload({
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

  it('keeps other timeout durations visible without transport metadata', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: false,
        payload: createErrorToastPayload({
          title: 'timeout of 5000ms exceeded',
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

  it('keeps server timeout responses visible even with a transport timeout code', () => {
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
    ).toBe(false);
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

  it('keeps HTTP status responses visible even with network error metadata', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: true,
        payload: createErrorToastPayload({
          errorClassName: EOneKeyErrorClassNames.AxiosNetworkError,
          httpStatusCode: 503,
          title: '网络错误',
        }),
      }),
    ).toBe(false);
  });

  it('keeps numeric errorCode HTTP responses visible even with network error text', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: false,
        payload: createErrorToastPayload({
          errorCode: 503,
          title: 'Network error',
        }),
      }),
    ).toBe(false);
  });

  it('does not treat default OneKey error codes as HTTP status responses', () => {
    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: true,
        payload: createErrorToastPayload({
          errorClassName: EOneKeyErrorClassNames.AxiosNetworkError,
          errorCode: -99_999,
          title: '网络错误',
        }),
      }),
    ).toBe(true);

    expect(
      shouldSuppressNetworkErrorToast({
        isInternetReachable: false,
        payload: createErrorToastPayload({
          errorClassName: EOneKeyErrorClassNames.AxiosNetworkError,
          httpStatusCode: -99_999,
          title: 'Network error',
        }),
      }),
    ).toBe(true);
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
