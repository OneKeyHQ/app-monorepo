/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useScanCameras as useDesktopScanCameras } from './useScanCameras.desktop';

import type { IScanCameraInfo } from './types';

jest.mock('@onekeyfe/react-native-qr-scanner/web', () => ({}));

const back: IScanCameraInfo = { id: 'back', label: 'Back', position: 'back' };
const usb: IScanCameraInfo = { id: 'usb', label: 'USB', position: 'external' };

test('desktop retains its list on failure and discovers a USB camera without a Chromium event', async () => {
  jest.useFakeTimers();
  const previousDesktopApi = globalThis.desktopApi;
  const listCameras = jest
    .fn<Promise<IScanCameraInfo[] | null>, []>()
    .mockResolvedValueOnce([back])
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce([back, usb])
    .mockResolvedValueOnce([usb]);
  Object.defineProperty(globalThis, 'desktopApi', {
    configurable: true,
    writable: true,
    value: { qrScanner: { listCameras } },
  });
  try {
    const { result, rerender, unmount } = renderHook(
      (active: boolean) => useDesktopScanCameras(1, false, active),
      { initialProps: true },
    );
    await waitFor(() =>
      expect(result.current).toEqual({ cameras: [back], loaded: true }),
    );

    await act(async () => {
      jest.advanceTimersToNextTimer();
    });
    expect(listCameras).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ cameras: [back], loaded: true });

    await act(async () => {
      jest.advanceTimersToNextTimer();
    });
    expect(result.current).toEqual({ cameras: [back, usb], loaded: true });

    rerender(false);
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(listCameras).toHaveBeenCalledTimes(3);

    rerender(true);
    await waitFor(() =>
      expect(result.current).toEqual({ cameras: [usb], loaded: true }),
    );
    expect(listCameras).toHaveBeenCalledTimes(4);

    unmount();
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(listCameras).toHaveBeenCalledTimes(4);
  } finally {
    globalThis.desktopApi = previousDesktopApi;
    jest.useRealTimers();
  }
});
