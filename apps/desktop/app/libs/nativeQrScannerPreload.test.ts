/** @jest-environment jsdom */

import { desktopQrPreviewPrefix } from '@onekeyhq/shared/types/desktopQrScanner';

import { createNativeQrScannerBridge } from './nativeQrScannerPreload';

type ITexture = {
  getVideoFrame: () => {
    displayWidth: number;
    displayHeight: number;
    close: () => void;
  };
  release: () => void;
};

const mockRegisterReceiver = jest.fn<
  void,
  [
    (
      event: { importedSharedTexture: ITexture },
      sessionId: string,
      revision?: number,
    ) => Promise<void>,
  ]
>();

jest.mock('electron', () => ({
  ipcRenderer: { invoke: jest.fn(async () => true) },
  sharedTexture: {
    setSharedTextureReceiver: (
      receiver: Parameters<typeof mockRegisterReceiver>[0],
    ) => mockRegisterReceiver(receiver),
  },
}));

test('freezing keeps the current pixels and releases incoming shared textures without opening their frames', async () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  const isMainFrame = Object.getOwnPropertyDescriptor(process, 'isMainFrame');
  const drawImage = jest.fn();
  const canvas = document.createElement('canvas');
  const sessionId = 'preview-session';
  const close = jest.fn();
  const getVideoFrame = jest.fn(() => ({
    displayWidth: 1280,
    displayHeight: 720,
    close,
  }));
  const release = jest.fn();
  const texture = { importedSharedTexture: { getVideoFrame, release } };
  canvas.id = desktopQrPreviewPrefix + sessionId;
  Object.defineProperty(canvas, 'getContext', { value: () => ({ drawImage }) });
  document.body.append(canvas);
  Object.defineProperty(process, 'platform', { ...platform, value: 'darwin' });
  Object.defineProperty(process, 'isMainFrame', {
    configurable: true,
    value: true,
  });

  try {
    const bridge = createNativeQrScannerBridge()!;
    await bridge.start(sessionId);
    const receive = mockRegisterReceiver.mock.lastCall![0];
    await receive(texture, sessionId, 0);
    expect(bridge.hasFreshPreview?.(sessionId, 0)).toBe(true);
    bridge.setPreviewFrozen?.(sessionId, true, 1);
    await receive(texture, sessionId, 1);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(getVideoFrame).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(2);

    bridge.setPreviewFrozen?.(sessionId, false, 2);
    expect(bridge.hasFreshPreview?.(sessionId, 2)).toBe(false);
    await receive(texture, sessionId, 0);
    expect(getVideoFrame).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(3);
    expect(bridge.hasFreshPreview?.(sessionId, 2)).toBe(false);

    await receive(texture, sessionId, 2);
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(4);
    expect(bridge.hasFreshPreview?.(sessionId, 2)).toBe(true);
  } finally {
    canvas.remove();
    Object.defineProperty(process, 'platform', platform);
    if (isMainFrame) Object.defineProperty(process, 'isMainFrame', isMainFrame);
    else Reflect.deleteProperty(process, 'isMainFrame');
  }
});
