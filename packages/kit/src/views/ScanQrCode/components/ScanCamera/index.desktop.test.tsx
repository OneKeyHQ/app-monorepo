/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { randomUUID } from 'node:crypto';

import { render } from '@testing-library/react';

import { ScanCamera } from './index.desktop';

const mockStart = jest
  .fn<Promise<boolean>, [string, string?]>()
  .mockResolvedValue(true);
const mockStop = jest.fn(async (_id: string) => {});
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

it('restarts the same modal camera after DeviceStage releases capture', () => {
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
        onEvent: () => mockUnsubscribe,
      },
    },
  });

  try {
    const { rerender } = render(
      <>
        <ScanCamera key="modal" cameraId="modal-camera" />
      </>,
    );
    const [modalSession] = mockStart.mock.calls[0];
    expect(mockStart).toHaveBeenLastCalledWith(modalSession, 'modal-camera');

    mockStageStep = 'scanQr';
    rerender(
      <>
        <ScanCamera key="modal" cameraId="modal-camera" />
        <ScanCamera
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
        <ScanCamera key="modal" cameraId="modal-camera" />
      </>,
    );
    expect(mockStop).toHaveBeenCalledWith(stageSession);
    expect(mockStart).toHaveBeenCalledTimes(2);

    mockStageStep = 'off';
    rerender(
      <>
        <ScanCamera key="modal" cameraId="modal-camera" />
      </>,
    );
    const [resumedSession] = mockStart.mock.calls[2];
    expect(mockStart).toHaveBeenLastCalledWith(resumedSession, 'modal-camera');
    expect(resumedSession).not.toBe(modalSession);
  } finally {
    globalThis.desktopApi = previousDesktopApi;
    if (previousUuid) {
      Object.defineProperty(crypto, 'randomUUID', previousUuid);
    } else {
      Reflect.deleteProperty(crypto, 'randomUUID');
    }
  }
});
