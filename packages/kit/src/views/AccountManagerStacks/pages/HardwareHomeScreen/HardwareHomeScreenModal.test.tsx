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
  readDirectoryAsync,
} from 'expo-file-system/legacy';
import { createIntl } from 'react-intl';
import { Platform, Image as RNImage } from 'react-native';

import { ImageCrop, Toast } from '@onekeyhq/components';
import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IHardwareHomeScreenData } from '@onekeyhq/kit-bg/src/services/ServiceHardware/DeviceSettingsManager';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes';
import imageUtils from '@onekeyhq/shared/src/utils/imageUtils';

import HardwareHomeScreenModal from './HardwareHomeScreenModal';
import UploadedHomeScreenCache from './uploadedHomeScreenCache';

type ISetDeviceHomeScreen =
  typeof backgroundApiProxy.serviceHardware.setDeviceHomeScreen;

const mockMessages: Record<string, string> = enMessages;
const mockIntl = createIntl({ locale: 'en-US', messages: mockMessages });
const mockClose = jest.fn();
const mockEmit = jest.fn();
const mockSetDeviceHomeScreen = jest.fn<
  ReturnType<ISetDeviceHomeScreen>,
  Parameters<ISetDeviceHomeScreen>
>();
let mockOnConfirm: (close: () => void) => Promise<void>;
let mockOnUpload: () => Promise<void>;

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

jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  Image: { getSize: jest.fn() },
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
    IconButton: ({
      onPress,
      testID,
    }: {
      onPress?: () => Promise<void>;
      testID?: string;
    }) => {
      if (testID === 'account-manager-upload-button-icon-btn' && onPress) {
        mockOnUpload = onPress;
      }
      return null;
    },
    Image: () => null,
    ImageCrop: { openPicker: jest.fn() },
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
      getDeviceHomeScreenConfig: jest.fn(async () => ({
        names: [],
        size: { width: 128, height: 64 },
      })),
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

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/errors/utils/errorToastUtils')
  >('@onekeyhq/shared/src/errors/utils/errorToastUtils');
  return {
    __esModule: true,
    default: {
      ...actual.default,
      toastIfError: jest.fn(actual.default.toastIfError),
    },
  };
});

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: jest.requireActual<
    typeof import('@onekeyhq/shared/src/eventBus/appEventBusNames')
  >('@onekeyhq/shared/src/eventBus/appEventBusNames').EAppEventBusNames,
  appEventBus: {
    emit: (...args: unknown[]) => {
      mockEmit(...args);
    },
  },
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom/utils', () => ({
  getInstanceId: async () => 'instance-test',
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
jest.mock('@onekeyhq/shared/src/utils/imageUtils', () => ({
  __esModule: true,
  default: { resizeImage: jest.fn() },
}));
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
  readDirectoryAsync: jest.fn(),
}));
jest.mock('./uploadedHomeScreenCache', () => ({
  __esModule: true,
  default: { getCacheList: jest.fn(() => []), saveCache: jest.fn() },
}));

describe('wallpaper original image cache', () => {
  const cache = jest.requireActual<typeof import('./uploadedHomeScreenCache')>(
    './uploadedHomeScreenCache',
  ).default;
  const files = new Map<string, number>();
  const modifiedAt = new Map<string, number>();
  const url = 'https://example.com/wallpaper.png';
  let now: number;

  beforeEach(() => {
    jest.clearAllMocks();
    files.clear();
    modifiedAt.clear();
    now = 1_793_772_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.spyOn(Platform, 'select').mockReturnValue(true);
    jest.spyOn(RNImage, 'getSize').mockImplementation((_uri, success) => {
      success(604, 1024);
    });
    Object.assign(platformEnv, { isNative: true });
    jest.mocked(getInfoAsync).mockImplementation(async (uri) => {
      const size = files.get(uri);
      return size === undefined
        ? { exists: false, isDirectory: false, uri }
        : {
            exists: true,
            isDirectory: false,
            uri,
            size,
            modificationTime: modifiedAt.get(uri) ?? now / 1000,
          };
    });
    jest
      .mocked(readDirectoryAsync)
      .mockImplementation(async (directory) =>
        [...files.keys()]
          .filter((uri) => uri.startsWith(directory))
          .map((uri) => uri.slice(directory.length)),
      );
    jest.mocked(makeDirectoryAsync).mockResolvedValue(undefined);
    jest.mocked(deleteAsync).mockImplementation(async (uri) => {
      files.delete(uri);
      modifiedAt.delete(uri);
    });
    jest.mocked(downloadAsync).mockImplementation(async (_url, uri) => {
      files.set(uri, 100);
      modifiedAt.set(uri, now / 1000);
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
      modifiedAt.set(to, modifiedAt.get(from) ?? now / 1000);
      files.delete(from);
      modifiedAt.delete(from);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
    jest.mocked(Platform.select).mockReturnValue(false);
    await expect(cache.getOriginalImageUri(url)).resolves.toBe(url);
    expect(downloadAsync).not.toHaveBeenCalled();
  });

  it('refreshes a changed response at the same URL after 24 hours', async () => {
    const uri = await cache.getOriginalImageUri(url);
    now += 24 * 60 * 60 * 1000;
    jest.mocked(downloadAsync).mockImplementationOnce(async (_url, target) => {
      files.set(target, 200);
      modifiedAt.set(target, now / 1000);
      return {
        uri: target,
        status: 200,
        headers: {},
        mimeType: 'image/png',
      };
    });
    await expect(cache.getOriginalImageUri(url)).resolves.toBe(uri);
    expect(downloadAsync).toHaveBeenCalledTimes(2);
    expect(files.get(uri ?? '')).toBe(200);
  });

  it('removes expired originals and abandoned partial files on access', async () => {
    const directory = 'file:///cache/hardware-wallpapers/';
    const expired = `${directory}old.img`;
    const partial = `${directory}old.img.interrupted.part`;
    for (const uri of [expired, partial]) {
      files.set(uri, 100);
      modifiedAt.set(uri, now / 1000 - 24 * 60 * 60);
    }
    await cache.getOriginalImageUri(url);
    expect(files.has(expired)).toBe(false);
    expect(files.has(partial)).toBe(false);
    expect(files.size).toBe(1);
  });

  it('evicts older originals before publishing beyond 50 MB', async () => {
    const older = await cache.getOriginalImageUri(`${url}?older`);
    now += 1000;
    const newer = await cache.getOriginalImageUri(`${url}?newer`);
    if (!older || !newer) throw new OneKeyLocalError('Missing cache URI');
    files.set(older, 25 * 1024 * 1024);
    files.set(newer, 25 * 1024 * 1024);
    await cache.getOriginalImageUri(url);
    expect(files.has(older)).toBe(false);
    expect(files.has(newer)).toBe(true);
    expect(
      [...files.values()].reduce((sum, size) => sum + size, 0),
    ).toBeLessThanOrEqual(50 * 1024 * 1024);
  });

  it('rejects a nonimage HTTP 200 response and retries after recovery', async () => {
    jest.mocked(downloadAsync).mockImplementationOnce(async (_url, uri) => {
      files.set(uri, 100);
      return { uri, status: 200, headers: {}, mimeType: 'text/html' };
    });
    jest
      .mocked(RNImage.getSize)
      .mockImplementationOnce((_uri, _success, failure) => {
        failure?.(new OneKeyLocalError('Invalid image'));
      });
    await expect(cache.getOriginalImageUri(url)).rejects.toThrow(
      'Invalid image',
    );
    expect(files.size).toBe(0);
    expect(moveAsync).not.toHaveBeenCalled();
    await expect(cache.getOriginalImageUri(url)).resolves.toBeDefined();
    expect(downloadAsync).toHaveBeenCalledTimes(2);
  });

  it('replaces an invalid previously cached original', async () => {
    const uri = await cache.getOriginalImageUri(url);
    jest
      .mocked(RNImage.getSize)
      .mockImplementationOnce((_uri, _success, failure) => {
        failure?.(new OneKeyLocalError('Invalid cached image'));
      });
    await expect(cache.getOriginalImageUri(url)).resolves.toBe(uri);
    expect(downloadAsync).toHaveBeenCalledTimes(2);
  });

  it('does not publish an image larger than the cache limit', async () => {
    jest.mocked(downloadAsync).mockImplementationOnce(async (_url, uri) => {
      files.set(uri, 50 * 1024 * 1024 + 1);
      return { uri, status: 200, headers: {}, mimeType: 'image/png' };
    });
    await expect(cache.getOriginalImageUri(url)).rejects.toThrow();
    expect(files.size).toBe(0);
    expect(moveAsync).not.toHaveBeenCalled();
  });

  it('keeps concurrent downloads of different URLs within the cache limit', async () => {
    jest.mocked(downloadAsync).mockImplementation(async (_url, uri) => {
      files.set(uri, 20 * 1024 * 1024);
      modifiedAt.set(uri, now / 1000);
      return { uri, status: 200, headers: {}, mimeType: 'image/png' };
    });
    await Promise.all(
      [1, 2, 3].map((version) =>
        cache.getOriginalImageUri(`${url}?version=${version}`),
      ),
    );
    expect(downloadAsync).toHaveBeenCalledTimes(3);
    expect(files.size).toBe(2);
    expect(
      [...files.values()].reduce((sum, size) => sum + size, 0),
    ).toBeLessThanOrEqual(50 * 1024 * 1024);
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
    {
      scenario: 'picker Error',
      error: Object.assign(new Error('User cancelled image selection'), {
        code: 'E_PICKER_CANCELLED',
      }),
    },
    {
      scenario: 'plain cancellation object',
      error: { code: 'E_PICKER_CANCELLED' },
    },
  ])(
    'finishes a cancelled upload from $scenario silently',
    async ({ error }) => {
      const saveCacheSpy = jest.spyOn(UploadedHomeScreenCache, 'saveCache');
      jest.mocked(ImageCrop.openPicker).mockRejectedValueOnce(error);
      await renderSelectedWallpaper(EDeviceType.Classic1s);

      await act(async () => {
        await expect(mockOnUpload()).resolves.toBeUndefined();
      });

      expect(ImageCrop.openPicker).toHaveBeenCalledWith({
        width: 128,
        height: 64,
      });
      expect(errorToastUtils.toastIfError).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
      expect(Toast.error).not.toHaveBeenCalled();
      expect(imageUtils.resizeImage).not.toHaveBeenCalled();
      expect(saveCacheSpy).not.toHaveBeenCalled();
      expect(
        screen
          .getByTestId('hardware-wallpaper-apply-button')
          .hasAttribute('disabled'),
      ).toBe(false);
    },
  );

  it('shows picker failures without creating a wallpaper cache entry', async () => {
    const saveCacheSpy = jest.spyOn(UploadedHomeScreenCache, 'saveCache');
    const error = new Error('Unable to decode the selected image');
    jest.mocked(ImageCrop.openPicker).mockRejectedValueOnce(error);
    await renderSelectedWallpaper(EDeviceType.Classic1s);

    await act(async () => {
      await expect(mockOnUpload()).resolves.toBeUndefined();
    });

    expect(errorToastUtils.toastIfError).toHaveBeenCalledWith(error);
    expect(mockEmit).toHaveBeenCalledWith(
      EAppEventBusNames.ShowToast,
      expect.objectContaining({ method: 'error', title: error.message }),
    );
    expect(imageUtils.resizeImage).not.toHaveBeenCalled();
    expect(saveCacheSpy).not.toHaveBeenCalled();
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
