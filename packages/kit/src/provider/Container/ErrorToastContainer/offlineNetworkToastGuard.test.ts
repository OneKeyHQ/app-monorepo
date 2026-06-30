import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { shouldSuppressOfflineNetworkErrorToast } from './offlineNetworkToastGuard';

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
      shouldSuppressOfflineNetworkErrorToast({
        isInternetReachable: false,
        payload: createErrorToastPayload({
          errorClassName: EOneKeyErrorClassNames.AxiosNetworkError,
          title: 'Network error',
        }),
      }),
    ).toBe(true);
  });

  it('suppresses timeout toast regardless of network status', () => {
    const payload = createErrorToastPayload({
      errorCode: 'ECONNABORTED',
      errorName: 'AxiosError',
      title: 'timeout of 30000ms exceeded',
    });

    expect(
      shouldSuppressOfflineNetworkErrorToast({
        isInternetReachable: false,
        payload,
      }),
    ).toBe(true);

    expect(
      shouldSuppressOfflineNetworkErrorToast({
        isInternetReachable: true,
        payload,
      }),
    ).toBe(true);

    expect(
      shouldSuppressOfflineNetworkErrorToast({
        isInternetReachable: null,
        payload,
      }),
    ).toBe(true);
  });

  it('suppresses generic timeout errors globally', () => {
    expect(
      shouldSuppressOfflineNetworkErrorToast({
        isInternetReachable: true,
        payload: createErrorToastPayload({
          title: 'Device method call timeout',
        }),
      }),
    ).toBe(true);
  });

  it('suppresses timeout text even when an HTTP status code exists', () => {
    expect(
      shouldSuppressOfflineNetworkErrorToast({
        isInternetReachable: true,
        payload: createErrorToastPayload({
          httpStatusCode: 408,
          title: 'Request timeout',
        }),
      }),
    ).toBe(true);
  });

  it('keeps server and business errors visible while offline', () => {
    expect(
      shouldSuppressOfflineNetworkErrorToast({
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
      shouldSuppressOfflineNetworkErrorToast({
        isInternetReachable: false,
        payload: {
          method: 'warning',
          title: 'Warning',
        },
      }),
    ).toBe(false);
  });
});
