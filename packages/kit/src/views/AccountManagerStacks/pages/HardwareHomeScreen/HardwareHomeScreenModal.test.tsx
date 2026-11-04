/** @jest-environment jsdom */
import type { ComponentProps, ReactNode } from 'react';

import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  deleteAsync,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
  moveAsync,
} from 'expo-file-system/legacy';
import { createIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IHardwareHomeScreenData } from '@onekeyhq/kit-bg/src/services/ServiceHardware/DeviceSettingsManager';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
    hardware: {
      homescreen: {
        setHomeScreen: jest.fn(),
        wallpaperApply: jest.fn(),
      },
    },
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
jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: () => 'wallpaper-cache-test',
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: jest.fn(),
  downloadAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  moveAsync: jest.fn(),
}));
jest.mock('./uploadedHomeScreenCache', () => ({
  __esModule: true,
  default: { getCacheList: jest.fn(() => []) },
}));

describe('wallpaper original image cache', () => {
  const cache = jest.requireActual<typeof import('./uploadedHomeScreenCache')>(
    './uploadedHomeScreenCache',
  ).default;
  const files = new Map<string, number>();
  const url = 'https://example.com/wallpaper.png';

  beforeEach(() => {
    jest.clearAllMocks();
    files.clear();
    Object.assign(platformEnv, { isNative: true });
    jest.mocked(getInfoAsync).mockImplementation(async (uri) => {
      const size = files.get(uri);
      return size === undefined
        ? { exists: false, isDirectory: false, uri }
        : { exists: true, isDirectory: false, uri, size, modificationTime: 1 };
    });
    jest.mocked(makeDirectoryAsync).mockResolvedValue(undefined);
    jest.mocked(deleteAsync).mockImplementation(async (uri) => {
      files.delete(uri);
    });
    jest.mocked(downloadAsync).mockImplementation(async (_url, uri) => {
      files.set(uri, 100);
      return {
        uri,
        status: 200,
        headers: { 'content-type': 'image/png' },
        mimeType: 'image/png',
      };
    });
    jest.mocked(moveAsync).mockImplementation(async ({ from, to }) => {
      const size = files.get(from);
      if (size === undefined) {
        throw new OneKeyLocalError('Missing temporary download');
      }
      files.set(to, size);
      files.delete(from);
    });
  });

  afterEach(() => {
    Object.assign(platformEnv, { isNative: false });
  });

  it('retains the original file and reuses it for the same URL', async () => {
    const uri = await cache.getOriginalImageUri(url);
    expect(uri).toMatch(/^file:\/\/\/cache\/hardware-wallpapers\//u);
    await expect(cache.getOriginalImageUri(url)).resolves.toBe(uri);
    expect(downloadAsync).toHaveBeenCalledTimes(1);
    expect(moveAsync).toHaveBeenCalledTimes(1);
    expect(files.get(uri ?? '')).toBe(100);
    expect(deleteAsync).not.toHaveBeenCalled();
  });

  it('shares an in-flight download for the same URL', async () => {
    const uris = await Promise.all([
      cache.getOriginalImageUri(url),
      cache.getOriginalImageUri(url),
    ]);
    expect(uris[0]).toBe(uris[1]);
    expect(downloadAsync).toHaveBeenCalledTimes(1);
  });

  it('uses the full URL including its query to distinguish originals', async () => {
    const first = await cache.getOriginalImageUri(`${url}?version=1`);
    const second = await cache.getOriginalImageUri(`${url}?version=2`);
    expect(first).not.toBe(second);
    expect(downloadAsync).toHaveBeenCalledTimes(2);
  });

  it.each(['missing', 'empty'] as const)(
    'downloads again when the cached file is %s',
    async (state) => {
      const uri = await cache.getOriginalImageUri(url);
      if (!uri) throw new OneKeyLocalError('Missing cache URI');
      if (state === 'missing') files.delete(uri);
      else files.set(uri, 0);
      await expect(cache.getOriginalImageUri(url)).resolves.toBe(uri);
      expect(downloadAsync).toHaveBeenCalledTimes(2);
    },
  );

  it('cleans up a failed download and allows the next attempt to retry', async () => {
    jest.mocked(downloadAsync).mockImplementationOnce(async (_url, uri) => {
      files.set(uri, 20);
      throw new OneKeyLocalError('Download interrupted');
    });
    await expect(cache.getOriginalImageUri(url)).rejects.toThrow(
      'Download interrupted',
    );
    expect(files.size).toBe(0);
    expect(deleteAsync).toHaveBeenCalledTimes(1);
    await expect(cache.getOriginalImageUri(url)).resolves.toBeDefined();
    expect(downloadAsync).toHaveBeenCalledTimes(2);
  });

  it('does not retain an HTTP error response as an original', async () => {
    jest.mocked(downloadAsync).mockImplementationOnce(async (_url, uri) => {
      files.set(uri, 100);
      return { uri, status: 404, headers: {}, mimeType: 'text/plain' };
    });
    await expect(cache.getOriginalImageUri(url)).rejects.toThrow(
      'Wallpaper download did not complete',
    );
    expect(files.size).toBe(0);
    expect(moveAsync).not.toHaveBeenCalled();
  });

  it('passes through local images and non-native requests', async () => {
    await expect(cache.getOriginalImageUri('file:///picked.png')).resolves.toBe(
      'file:///picked.png',
    );
    Object.assign(platformEnv, { isNative: false });
    await expect(cache.getOriginalImageUri(url)).resolves.toBe(url);
    expect(downloadAsync).not.toHaveBeenCalled();
  });
});

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

  it('logs one final Pro2 result with the uploaded file size', async () => {
    const response = { message: 'Success', applyScreen: true, size: 4096 };
    mockSetDeviceHomeScreen.mockResolvedValueOnce(response);
    await renderSelectedWallpaper(EDeviceType.Pro2);

    await act(async () => mockOnConfirm(mockClose));

    const wallpaperApplyCalls = jest.mocked(defaultLogger.hardware.homescreen)
      .wallpaperApply.mock.calls;
    expect(wallpaperApplyCalls).toHaveLength(1);
    expect(wallpaperApplyCalls[0]?.[0]).toEqual(
      expect.objectContaining({
        status: 'success',
        uploadSizeBytes: 4096,
      }),
    );
  });

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
