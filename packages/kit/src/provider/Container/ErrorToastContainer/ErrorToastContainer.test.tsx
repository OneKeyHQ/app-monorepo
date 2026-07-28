/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import { Toast, globalNetInfo } from '@onekeyhq/components';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { ErrorToastContainer } from './ErrorToastContainer';

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: jest.fn(),
    message: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
  globalNetInfo: {
    currentState: jest.fn(() => ({
      isInternetReachable: true,
    })),
  },
}));

jest.mock('./ErrorToasts', () => ({
  getErrorAction: jest.fn(() => undefined),
}));

const mockedToast = Toast as unknown as {
  error: jest.Mock;
};
const mockedGlobalNetInfo = globalNetInfo as unknown as {
  currentState: jest.Mock;
};

describe('ErrorToastContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGlobalNetInfo.currentState.mockReturnValue({
      isInternetReachable: true,
    });
  });

  it('does not show axios network error toast when offline is already confirmed', () => {
    mockedGlobalNetInfo.currentState.mockReturnValue({
      isInternetReachable: false,
    });
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: 'Network error',
        errorClassName: EOneKeyErrorClassNames.AxiosNetworkError,
      });
    });

    expect(mockedToast.error).not.toHaveBeenCalled();
    unmount();
  });

  it('does not show axios network error toast before offline status is confirmed', () => {
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: '网络错误',
        errorClassName: EOneKeyErrorClassNames.AxiosNetworkError,
      });
    });

    expect(mockedToast.error).not.toHaveBeenCalled();
    unmount();
  });

  it('does not show timeout toast even when network status is online', () => {
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: 'timeout of 30000ms exceeded',
        errorCode: 'ECONNABORTED',
        errorName: 'AxiosError',
      });
    });

    expect(mockedToast.error).not.toHaveBeenCalled();
    unmount();
  });

  it('shows numeric errorCode HTTP responses even when offline', () => {
    mockedGlobalNetInfo.currentState.mockReturnValue({
      isInternetReachable: false,
    });
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: 'Network error',
        errorCode: 503,
      });
    });

    expect(mockedToast.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Network error',
      }),
    );
    unmount();
  });

  it('does not use default OneKey error code as an effective HTTP status', () => {
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: '网络错误',
        errorClassName: EOneKeyErrorClassNames.AxiosNetworkError,
        errorCode: -99_999,
      });
    });

    expect(mockedToast.error).not.toHaveBeenCalled();
    unmount();
  });

  it('shows generic timeout text when it is not a transport timeout', () => {
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: 'Device method call timeout',
      });
    });

    expect(mockedToast.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Device method call timeout',
      }),
    );
    unmount();
  });
});
