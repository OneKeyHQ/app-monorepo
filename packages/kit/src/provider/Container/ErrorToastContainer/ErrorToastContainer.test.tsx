/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import { Toast, globalNetInfo } from '@onekeyhq/components';
import {
  NeedFirmwareUpgradeFromWeb,
  UnknownHardwareError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ErrorToastContainer } from './ErrorToastContainer';
import { getErrorAction } from './ErrorToasts';

const mockSubscribeNativeStorageContractViolations = jest.fn();

jest.mock('react-intl', () => {
  const actual = jest.requireActual<typeof import('react-intl')>('react-intl');
  const intl = actual.createIntl({
    locale: 'zh-CN',
    messages: jest.requireActual('@onekeyhq/shared/src/locale/json/zh_CN.json'),
  });
  return { ...actual, useIntl: () => intl };
});

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

jest.mock(
  '@onekeyhq/shared/src/storage/nativeStorageContractViolationSubscription',
  () => ({
    subscribeNativeStorageContractViolations: (
      listener: (violation: unknown) => void,
    ) => {
      const unsubscribe: unknown =
        mockSubscribeNativeStorageContractViolations(listener);
      return typeof unsubscribe === 'function' ? unsubscribe : () => undefined;
    },
  }),
);

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
    mockSubscribeNativeStorageContractViolations.mockReturnValue(jest.fn());
    mockedGlobalNetInfo.currentState.mockReturnValue({
      isInternetReachable: true,
    });
  });

  it('shows a diagnostic toast for a blocked AsyncStorage API', () => {
    const { unmount } = render(<ErrorToastContainer />);
    const listener = mockSubscribeNativeStorageContractViolations.mock
      .calls[0][0] as (violation: {
      apiName: string;
      runtime: 'main' | 'background';
    }) => void;

    act(() => {
      listener({ apiName: 'useAsyncStorage', runtime: 'background' });
    });

    expect(mockedToast.error).toHaveBeenCalledWith({
      title: 'Unsupported AsyncStorage API',
      message:
        'useAsyncStorage was blocked in the background runtime. See the device log for the call stack.',
      toastId: 'native-storage-contract:background:useAsyncStorage',
      duration: 10_000,
    });
    unmount();
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

  it.each([
    {
      errorCode: 110,
      title: 'Device Id in the features is not same.',
      i18nKey:
        ETranslations.hardware_device_information_is_inconsistent_it_may_be_caused_by_device_reset,
      expectedTitle:
        '设备连接状态已更新。请选择「添加钱包」>「连接硬件钱包」来重新设置。使用原助记词将恢复当前钱包，使用新助记词将创建新钱包。',
    },
    {
      errorCode: 118,
      title: 'Device check unlock type not match error',
      i18nKey: ETranslations.hardware_device_pin_state_error,
      expectedTitle: '输入的PIN码与当前钱包不符。请重试。',
    },
    {
      errorCode: 112,
      title: 'Device passphrase state error',
      i18nKey: ETranslations.hardware_device_passphrase_state_error,
      expectedTitle: 'Passphrase 与当前钱包不匹配，请再试一次',
    },
  ])(
    'localizes hardware error $errorCode on the main thread',
    ({ errorCode, title, i18nKey, expectedTitle }) => {
      const { unmount } = render(<ErrorToastContainer />);

      act(() => {
        appEventBus.emit(EAppEventBusNames.ShowToast, {
          method: 'error',
          title,
          errorCode,
          i18nKey,
        });
      });

      expect(mockedToast.error).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expectedTitle,
        }),
      );
      unmount();
    },
  );

  it.each([
    {
      ErrorClass: NeedFirmwareUpgradeFromWeb,
      expectedTitle:
        '您的硬件钱包固件需要更新。请在电脑上访问 firmware.onekey.so 进行升级。',
    },
    {
      ErrorClass: UnknownHardwareError,
      expectedTitle:
        '操作失败。请确保您的硬件和应用程序均为最新版本，或联系技术支持。 Firmware response detail : 800',
    },
  ])(
    'localizes the recovery toast from $ErrorClass.name and retains its action',
    async ({ ErrorClass, expectedTitle }) => {
      const { unmount } = render(<ErrorToastContainer />);
      const error = new ErrorClass({
        payload: {
          connectId: 'FIRMWARE_DEVICE_ID',
          code: 800,
          error: 'Firmware response detail',
        },
      });
      error.autoToast = true;
      // Error construction under Jest leaves the background fallback text;
      // the real UI formatter above must supply the Chinese guidance.
      expect(error.message).not.toBe(expectedTitle);
      const action = <span>Update firmware</span>;
      jest.mocked(getErrorAction).mockReturnValueOnce(action);
      const onShowToast = jest.fn();
      appEventBus.on(EAppEventBusNames.ShowToast, onShowToast);
      try {
        await act(async () => {
          errorToastUtils.showToastOfError(error);
        });
        expect(onShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            i18nKey: error.key,
            i18nInfo: error.info,
          }),
        );
        expect(getErrorAction).toHaveBeenCalledWith(
          expect.objectContaining({
            errorCode: error.code,
            connectId: 'FIRMWARE_DEVICE_ID',
          }),
        );
        expect(mockedToast.error).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expectedTitle,
            actions: action,
          }),
        );
      } finally {
        appEventBus.off(EAppEventBusNames.ShowToast, onShowToast);
        unmount();
      }
    },
  );

  it('preserves raw details for unrelated parameterized error keys', () => {
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: 'The request is too large for the current connection.',
        errorCode: 833,
        i18nKey: ETranslations.wallet_action_failed,
      });
    });

    expect(mockedToast.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'The request is too large for the current connection.',
      }),
    );
    unmount();
  });
});
