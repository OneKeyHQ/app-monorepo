/** @jest-environment jsdom */
import type { ComponentProps, ReactNode } from 'react';

import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IHardwareHomeScreenData } from '@onekeyhq/kit-bg/src/services/ServiceHardware/DeviceSettingsManager';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes';

import HardwareHomeScreenModal from './HardwareHomeScreenModal';

type ISetDeviceHomeScreen =
  typeof backgroundApiProxy.serviceHardware.setDeviceHomeScreen;

const mockMessages: Record<string, string> = enMessages;
const mockIntl = createIntl({ locale: 'en-US', messages: mockMessages });
const mockClose = jest.fn();
const mockSetDeviceHomeScreen = jest.fn<
  ReturnType<ISetDeviceHomeScreen>,
  Parameters<ISetDeviceHomeScreen>
>();
let mockOnConfirm: (close: () => void) => Promise<void>;

const mockWallpaper: IHardwareHomeScreenData = {
  id: 'wallpaper-test',
  wallpaperType: 'cobranding',
  resType: 'prebuilt',
  screenHex: '010203',
};

jest.mock('react-intl', () => ({
  ...jest.requireActual<typeof import('react-intl')>('react-intl'),
  useIntl: () => mockIntl,
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );

  return {
    Page: Object.assign(Container, {
      Header: () => null,
      Body: Container,
      Footer: ({
        onConfirm,
        confirmButtonProps,
      }: {
        onConfirm: typeof mockOnConfirm;
        confirmButtonProps: { disabled: boolean; testID: string };
      }) => {
        mockOnConfirm = onConfirm;
        return (
          <button
            type="button"
            data-testid={confirmButtonProps.testID}
            disabled={confirmButtonProps.disabled}
          >
            Confirm
          </button>
        );
      },
    }),
    Stack: Container,
    XStack: Container,
    YStack: Container,
    SizableText: Container,
    AnimatePresence: Container,
    Icon: () => null,
    IconButton: () => null,
    Image: () => null,
    Spinner: () => null,
    Alert: () => null,
    Toast: { success: jest.fn(), error: jest.fn() },
    useMedia: () => ({ gtMd: true }),
  };
});

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const { useEffect, useRef, useState } =
    jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: <T,>(method: () => Promise<T>) => {
      const methodRef = useRef(method);
      const [result, setResult] = useState<T>();
      useEffect(() => {
        let mounted = true;
        void methodRef.current().then((value) => {
          if (mounted) {
            setResult(value);
          }
        });
        return () => {
          mounted = false;
        };
      }, []);
      return { result, isLoading: false, run: jest.fn() };
    },
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: {
      getDeviceHomeScreenConfig: jest.fn(async () => ({})),
      fetchHardwareHomeScreen: jest.fn(async () => [mockWallpaper]),
      setDeviceHomeScreen: (...args: Parameters<ISetDeviceHomeScreen>) =>
        mockSetDeviceHomeScreen(...args),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/hardware/instance', () => ({
  CoreSDKLoader: jest.fn(async () => ({})),
}));

jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { toastIfError: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: { homescreen: { setHomeScreen: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isNativeAndroid: false },
}));

jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: { isTouchDevice: jest.fn(() => false) },
}));

jest.mock('@onekeyhq/shared/src/utils/deviceHomeScreenUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/imageUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({}));
jest.mock('./uploadedHomeScreenCache', () => ({
  __esModule: true,
  default: { getCacheList: jest.fn(() => []) },
}));

async function renderSelectedWallpaper(deviceType: EDeviceType) {
  const device: IDBDevice = {
    id: 'device-test',
    name: 'OneKey',
    deviceType,
    features: '{}',
    connectId: 'connect-test',
    uuid: 'uuid-test',
    deviceId: 'hardware-test',
    settingsRaw: '{}',
    createdAt: 0,
    updatedAt: 0,
  };
  render(
    <HardwareHomeScreenModal
      navigation={
        {} as ComponentProps<typeof HardwareHomeScreenModal>['navigation']
      }
      route={{
        key: 'wallpaper-test',
        name: EAccountManagerStacksRoutes.HardwareHomeScreenModal,
        params: { device },
      }}
    />,
  );

  const wallpaper = await screen.findByTestId(
    'hardware-wallpaper-cobranding-wallpaper-test',
  );
  fireEvent.click(within(wallpaper).getByRole('button'));
  expect(
    screen
      .getByTestId('hardware-wallpaper-apply-button')
      .hasAttribute('disabled'),
  ).toBe(false);
}

describe('hardware wallpaper confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [EDeviceType.Classic, true, 1],
    [EDeviceType.Classic1s, true, 1],
    [EDeviceType.ClassicPure, true, 1],
    [EDeviceType.Mini, true, 1],
    [EDeviceType.Touch, true, 1],
    [EDeviceType.Pro2, true, 1],
    [EDeviceType.Neo, true, 1],
    [EDeviceType.Pro, true, 0],
    [EDeviceType.Pro, false, 0],
  ] as const)(
    'closes %s with applyScreen=%s exactly %i times after success',
    async (deviceType, applyScreen, closeCount) => {
      mockSetDeviceHomeScreen.mockResolvedValueOnce({
        message: 'Success',
        applyScreen,
      });
      await renderSelectedWallpaper(deviceType);

      await act(async () => mockOnConfirm(mockClose));

      expect(mockSetDeviceHomeScreen).toHaveBeenCalledWith({
        dbDeviceId: 'device-test',
        screenItem: expect.objectContaining(mockWallpaper),
      });
      expect(mockClose).toHaveBeenCalledTimes(closeCount);
      expect(Toast.success).toHaveBeenCalledTimes(1);
    },
  );

  it('waits for the hardware update to finish before closing', async () => {
    let finishUpdate: (
      response: Awaited<ReturnType<ISetDeviceHomeScreen>>,
    ) => void = () => {};
    mockSetDeviceHomeScreen.mockReturnValueOnce(
      new Promise((resolve) => {
        finishUpdate = resolve;
      }),
    );
    await renderSelectedWallpaper(EDeviceType.Classic1s);

    let confirmation: Promise<void> | undefined;
    act(() => {
      confirmation = mockOnConfirm(mockClose);
    });
    expect(mockClose).not.toHaveBeenCalled();
    expect(Toast.success).not.toHaveBeenCalled();
    expect(
      screen
        .getByTestId('hardware-wallpaper-apply-button')
        .hasAttribute('disabled'),
    ).toBe(true);

    await act(async () => {
      finishUpdate({ message: 'Success', applyScreen: true });
      await confirmation;
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      scenario: 'hardware failure',
      error: new Error('Hardware update failed'),
    },
    {
      scenario: 'device cancellation',
      error: Object.assign(new Error('Cancelled on device'), {
        code: HardwareErrorCode.ActionCancelled,
      }),
    },
  ])('keeps the page open after $scenario', async ({ error }) => {
    mockSetDeviceHomeScreen.mockRejectedValueOnce(error);
    await renderSelectedWallpaper(EDeviceType.Classic1s);

    await act(async () => {
      await expect(mockOnConfirm(mockClose)).rejects.toBe(error);
    });

    expect(mockClose).not.toHaveBeenCalled();
    expect(Toast.success).not.toHaveBeenCalled();
    expect(errorToastUtils.toastIfError).toHaveBeenCalledWith(error);
    expect(
      screen
        .getByTestId('hardware-wallpaper-apply-button')
        .hasAttribute('disabled'),
    ).toBe(false);
  });
});
