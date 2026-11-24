/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useScanCameras } from './useScanCameras';
import { useScanCameras as useNativeScanCameras } from './useScanCameras.native';

import type { IScanCameraInfo } from './types';

const mockListWeb = jest.fn<Promise<IScanCameraInfo[]>, []>();
const mockSubscribeWeb = jest.fn<() => void, [() => void]>();
const mockListNative = jest.fn<Promise<IScanCameraInfo[]>, []>();
const mockSubscribeNative = jest.fn<() => void, [() => void]>();

jest.mock('@onekeyfe/react-native-qr-scanner/web', () => ({
  listWebCameras: () => mockListWeb(),
  subscribeWebCameraChanges: (listener: () => void) =>
    mockSubscribeWeb(listener),
}));
jest.mock('@onekeyfe/react-native-qr-scanner', () => ({
  listCameras: () => mockListNative(),
  subscribeCameraChanges: (listener: () => void) =>
    mockSubscribeNative(listener),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOSMacCatalyst: false },
}));

const back: IScanCameraInfo = { id: 'back', label: 'Back', position: 'back' };
const usb: IScanCameraInfo = { id: 'usb', label: 'USB', position: 'external' };

test('Web refreshes after camera readiness and ignores out-of-order enumerations', async () => {
  const unsubscribe = jest.fn();
  const older = Promise.withResolvers<IScanCameraInfo[]>();
  mockSubscribeWeb.mockReturnValue(unsubscribe);
  mockListWeb
    .mockResolvedValueOnce([back])
    .mockResolvedValueOnce([back])
    .mockReturnValueOnce(older.promise)
    .mockResolvedValueOnce([back, usb]);

  const { result, rerender, unmount } = renderHook(
    (cameraReady: number) => useScanCameras(cameraReady),
    { initialProps: 0 },
  );

  await waitFor(() =>
    expect(result.current).toEqual({ cameras: [back], loaded: false }),
  );
  rerender(1);
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(unsubscribe).toHaveBeenCalledTimes(1);

  const [refresh] = mockSubscribeWeb.mock.calls[1];
  await act(async () => {
    refresh();
    refresh();
  });
  await act(async () => older.resolve([usb]));
  expect(result.current).toEqual({ cameras: [back, usb], loaded: true });

  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(2);
  refresh();
  expect(mockListWeb).toHaveBeenCalledTimes(4);
});

test('native treats an empty result as loaded and keeps one subscription across ready events', async () => {
  const unsubscribe = jest.fn();
  mockSubscribeNative.mockReturnValue(unsubscribe);
  mockListNative.mockResolvedValueOnce([]).mockResolvedValueOnce([usb]);

  const { result, rerender, unmount } = renderHook(
    (cameraReady: number) => useNativeScanCameras(cameraReady),
    { initialProps: 0 },
  );
  await waitFor(() =>
    expect(result.current).toEqual({ cameras: [], loaded: true }),
  );

  rerender(1);
  expect(mockListNative).toHaveBeenCalledTimes(1);
  expect(mockSubscribeNative).toHaveBeenCalledTimes(1);

  const [refresh] = mockSubscribeNative.mock.calls[0];
  await act(async () => refresh());
  expect(result.current).toEqual({ cameras: [usb], loaded: true });
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
