/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { randomUUID } from 'node:crypto';

import { decodeQrImageSymbols } from '@onekeyfe/react-native-qr-scanner/web';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { ScanCamera } from './index.desktop';
import { useScanCameraIsActive } from './useScanCameraIsActive.desktop';

import type { IScanCameraProps } from './types';
import type { IMultiQrFrameEvent } from '../../utils/multiQrSymbols';
import type { IDesktopQrEvent } from '@onekeyhq/shared/types/desktopQrScanner';

const mockStart = jest
  .fn<Promise<boolean>, [string, string?]>()
  .mockResolvedValue(true);
const mockStop = jest.fn(async (_id: string) => {});
const mockFocus = jest
  .fn<Promise<boolean>, [string, number, number]>()
  .mockResolvedValue(true);
const mockUnsubscribe = jest.fn();
let mockStageStep: 'off' | 'processing' | 'scanQr' = 'off';

jest.mock('@onekeyfe/react-native-qr-scanner/web', () => ({
  decodeQrImageSymbols: jest.fn(),
}));
jest.mock('./webQrScanner', () => ({
  ensureWebQrScannerConfigured: jest.fn(),
}));

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
    canvas.width = 1280;
    canvas.height = 720;
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
    await act(async () => {
      fireEvent.click(canvas, { clientX: 0, clientY: 60 });
    });
    const [focusedSession, x, y] = mockFocus.mock.lastCall!;
    expect(focusedSession).toBe(resumedSession);
    expect(x).toBeCloseTo(0.218_75);
    expect(y).toBe(0.25);
    expect(screen.getByTestId('scan-camera-focus-box')).not.toBeNull();
  } finally {
    globalThis.desktopApi = previousDesktopApi;
    if (previousUuid) {
      Object.defineProperty(crypto, 'randomUUID', previousUuid);
    } else {
      Reflect.deleteProperty(crypto, 'randomUUID');
    }
  }
});

it('drops retired IPC and requires a rendered frame to verify a resumed single candidate', async () => {
  const previousDesktopApi = globalThis.desktopApi;
  const previousUuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  });
  let listener: (event: IDesktopQrEvent) => void = () => {};
  const hasFreshPreview = jest.fn(() => false);
  Object.defineProperty(globalThis, 'desktopApi', {
    configurable: true,
    writable: true,
    value: {
      qrScanner: {
        start: mockStart,
        stop: mockStop,
        focus: mockFocus,
        setPaused: jest.fn(async () => {}),
        setMultiSymbol: jest.fn(),
        setPreviewFrozen: jest.fn(),
        hasFreshPreview,
        onEvent: (callback: typeof listener) => {
          listener = callback;
          return mockUnsubscribe;
        },
      },
    },
  });
  const onFrameSymbols = jest.fn<void, [IMultiQrFrameEvent]>();
  try {
    const { rerender } = render(
      <ScanCamera frozen onFrameSymbols={onFrameSymbols} />,
    );
    rerender(<ScanCamera frozen={false} onFrameSymbols={onFrameSymbols} />);
    const [sessionId] = mockStart.mock.lastCall!;
    const canvas = document.querySelector('canvas')!;
    const toBlob = jest
      .spyOn(canvas, 'toBlob')
      .mockImplementation((receive) => {
        receive(new Blob());
      });
    const symbols = [{ text: 'old-candidate', centerX: 0.5, centerY: 0.5 }];
    const result = {
      type: 'symbols',
      sessionId,
      symbols,
      frameWidth: 80,
      frameHeight: 60,
    } as const;
    listener({ ...result, analysisRevision: 1 });
    expect(onFrameSymbols).not.toHaveBeenCalled();
    listener({ ...result, analysisRevision: 2 });
    const [event] = onFrameSymbols.mock.lastCall!;
    const receive = jest.fn(() => true);
    await event.verifyPreview?.(receive);
    expect(toBlob).not.toHaveBeenCalled();

    hasFreshPreview.mockReturnValue(true);
    jest
      .mocked(decodeQrImageSymbols)
      .mockResolvedValueOnce({ symbols, width: 80, height: 60 });
    await event.verifyPreview?.(receive);
    expect(receive).toHaveBeenCalledWith({
      symbols,
      coordinateSpace: 'frame',
      frameWidth: 80,
      frameHeight: 60,
    });
  } finally {
    globalThis.desktopApi = previousDesktopApi;
    if (previousUuid) Object.defineProperty(crypto, 'randomUUID', previousUuid);
    else Reflect.deleteProperty(crypto, 'randomUUID');
  }
});
