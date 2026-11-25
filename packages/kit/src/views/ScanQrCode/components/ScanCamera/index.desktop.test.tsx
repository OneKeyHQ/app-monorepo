/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { randomUUID } from 'node:crypto';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ScanCamera } from './index.desktop';
import { useScanCameraIsActive } from './useScanCameraIsActive.desktop';

import type { IScanCameraProps } from './types';

const mockStart = jest
  .fn<Promise<boolean>, [string, string?]>()
  .mockResolvedValue(true);
const mockStop = jest.fn(async (_id: string) => {});
const mockFocus = jest
  .fn<Promise<boolean>, [string, number, number]>()
  .mockResolvedValue(true);
const mockUnsubscribe = jest.fn();
let mockStageStep: 'off' | 'processing' | 'scanQr' = 'off';

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/hardware', () => ({
  useDeviceStageAtom: () => [{ step: mockStageStep }],
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('./index.tsx', () => ({ ScanCamera: () => null }));

function StageAwareCamera(props: IScanCameraProps) {
  const cameraActive = useScanCameraIsActive(props.disableNavigationGuard);
  return <ScanCamera {...props} cameraActive={cameraActive} />;
}

it('restarts the same modal camera after DeviceStage releases capture', async () => {
  const previousDesktopApi = globalThis.desktopApi;
  const previousUuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  });
  Object.defineProperty(globalThis, 'desktopApi', {
    configurable: true,
    writable: true,
    value: {
      qrScanner: {
        start: mockStart,
        stop: mockStop,
        focus: mockFocus,
        onEvent: () => mockUnsubscribe,
      },
    },
  });

  try {
    const { rerender } = render(
      <>
        <StageAwareCamera key="modal" cameraId="modal-camera" />
      </>,
    );
    const [modalSession] = mockStart.mock.calls[0];
    expect(mockStart).toHaveBeenLastCalledWith(modalSession, 'modal-camera');

    mockStageStep = 'scanQr';
    rerender(
      <>
        <StageAwareCamera key="modal" cameraId="modal-camera" />
        <StageAwareCamera
          key="stage"
          cameraId="stage-camera"
          disableNavigationGuard
        />
      </>,
    );
    const [stageSession] = mockStart.mock.calls[1];
    expect(mockStop).toHaveBeenCalledWith(modalSession);
    expect(mockStart).toHaveBeenLastCalledWith(stageSession, 'stage-camera');

    mockStageStep = 'processing';
    rerender(
      <>
        <StageAwareCamera key="modal" cameraId="modal-camera" />
      </>,
    );
    expect(mockStop).toHaveBeenCalledWith(stageSession);
    expect(mockStart).toHaveBeenCalledTimes(2);

    mockStageStep = 'off';
    rerender(
      <>
        <StageAwareCamera key="modal" cameraId="modal-camera" />
      </>,
    );
    const [resumedSession] = mockStart.mock.calls[2];
    expect(mockStart).toHaveBeenLastCalledWith(resumedSession, 'modal-camera');
    expect(resumedSession).not.toBe(modalSession);

    const canvas = document.querySelector('canvas')!;
    jest.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 240,
      height: 240,
      right: 240,
      bottom: 240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.click(canvas, { clientX: 120, clientY: 60 });
    expect(mockFocus).toHaveBeenCalledWith(resumedSession, 0.5, 0.25);
    await waitFor(() => {
      expect(screen.getByTestId('scan-camera-focus-box')).not.toBeNull();
    });
  } finally {
    globalThis.desktopApi = previousDesktopApi;
    if (previousUuid) {
      Object.defineProperty(crypto, 'randomUUID', previousUuid);
    } else {
      Reflect.deleteProperty(crypto, 'randomUUID');
    }
  }
});
