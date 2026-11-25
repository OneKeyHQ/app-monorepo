import { ipcMain, sharedTexture } from 'electron';

import { desktopQrScannerChannel } from '@onekeyhq/shared/types/desktopQrScanner';
import type {
  IDesktopQrCamera,
  IDesktopQrError,
  IDesktopQrEvent,
} from '@onekeyhq/shared/types/desktopQrScanner';

import type { IIsTrustedMainWindowSender } from './mainWindowShellTrust';
import type { BrowserWindow, IpcMainInvokeEvent, WebFrameMain } from 'electron';

type INativeQrFrame = {
  width: number;
  height: number;
  generation: number;
  ioSurface?: Buffer;
  ntHandle?: Buffer;
  release(): void;
};

type INativeCamera = {
  id: string;
  name?: string;
  label?: string;
  position?: IDesktopQrCamera['position'];
  isDefault?: boolean;
};

type INativeReadyInfo = {
  autoFocusSupported?: boolean;
};

type INativeScanner = {
  listCameras(): INativeCamera[] | Promise<INativeCamera[]>;
  createCapture(options: {
    source: { kind: 'camera'; deviceId?: string };
    onReady(
      generation: number,
      deviceOrInfo?: string | INativeReadyInfo,
      windowsDeviceId?: string,
    ): void;
    onText(text: string, generation: number): void;
    onError(error: { code?: string }, generation: number): void;
    onFrame(frame: INativeQrFrame): void;
  }): {
    start(): void;
    focus?(x?: number, y?: number): boolean;
    dispose(): void;
  };
};

function loadNativeScanner(): INativeScanner | undefined {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return;
  try {
    return require('@onekeyfe/electron-qr-scanner') as INativeScanner;
  } catch {
    return undefined;
  }
}

function cameraErrorCode(code?: string): IDesktopQrError {
  switch (code) {
    case 'permission-denied':
    case 'no-camera':
    case 'camera-busy':
    case 'preview-unavailable':
      return code;
    default:
      return 'decoder-unavailable';
  }
}

type ILease = {
  sessionId: string;
  frame: WebFrameMain;
  capture?: ReturnType<INativeScanner['createCapture']>;
  generation?: number;
  autoFocusSupported?: boolean;
};

export function installNativeQrScanner(
  window: BrowserWindow,
  isTrustedSender: IIsTrustedMainWindowSender,
) {
  let lease: ILease | undefined;
  let textureInFlight = false;

  const trusted = (frame: WebFrameMain | null) =>
    !window.isDestroyed() &&
    isTrustedSender(window.webContents.id, frame, window.webContents.mainFrame);

  const stop = () => {
    const previous = lease;
    lease = undefined;
    previous?.capture?.dispose();
  };

  const send = (active: ILease, event: IDesktopQrEvent) => {
    if (lease === active && trusted(active.frame)) {
      active.frame.send(desktopQrScannerChannel.event, event);
    }
  };

  const fail = (active: ILease, code: IDesktopQrError) => {
    if (lease !== active) return;
    send(active, { type: 'error', sessionId: active.sessionId, code });
    stop();
  };

  const sendPreview = async (active: ILease, frame: INativeQrFrame) => {
    if (
      lease !== active ||
      frame.generation !== active.generation ||
      textureInFlight ||
      !trusted(active.frame) ||
      !window.isVisible() ||
      window.isMinimized()
    ) {
      frame.release();
      return;
    }
    const handle = frame.ioSurface
      ? { ioSurface: frame.ioSurface }
      : { ntHandle: frame.ntHandle };
    let imported;
    try {
      imported = sharedTexture.importSharedTexture({
        textureInfo: {
          pixelFormat: 'bgra',
          codedSize: { width: frame.width, height: frame.height },
          handle,
        },
        allReferencesReleased: () => frame.release(),
      });
    } catch {
      frame.release();
      fail(active, 'preview-unavailable');
      return;
    }
    textureInFlight = true;
    try {
      await sharedTexture.sendSharedTexture(
        { frame: active.frame, importedSharedTexture: imported },
        active.sessionId,
      );
    } catch {
      fail(active, 'preview-unavailable');
    } finally {
      imported.release();
      textureInFlight = false;
    }
  };

  const trustedInvoke = (event: IpcMainInvokeEvent) =>
    !window.isDestroyed() &&
    event.sender === window.webContents &&
    trusted(event.senderFrame);

  const start = async (
    event: IpcMainInvokeEvent,
    sessionId: unknown,
    cameraId: unknown,
  ) => {
    const frame = event.senderFrame;
    if (
      !frame ||
      !trustedInvoke(event) ||
      typeof sessionId !== 'string' ||
      !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(sessionId) ||
      (cameraId !== undefined &&
        (typeof cameraId !== 'string' || cameraId.length > 4096)) ||
      !window.isVisible() ||
      window.isMinimized() ||
      !sharedTexture
    )
      return false;

    const scanner = loadNativeScanner();
    if (!scanner) return false;

    stop();
    const active: ILease = { sessionId, frame };
    lease = active;
    try {
      const cameras = await scanner.listCameras();
      if (lease !== active) return false;
      if (!trusted(frame)) {
        stop();
        return false;
      }
      const selected = cameras.find((camera) => camera.id === cameraId);
      active.capture = scanner.createCapture({
        source: { kind: 'camera', deviceId: selected?.id },
        onReady(generation, deviceOrInfo, windowsDeviceId) {
          if (lease !== active) return;
          active.generation = generation;
          if (typeof deviceOrInfo === 'object' && deviceOrInfo !== null) {
            active.autoFocusSupported = Boolean(
              deviceOrInfo.autoFocusSupported,
            );
          }
          const openedCameraId =
            (typeof deviceOrInfo === 'string' && deviceOrInfo) ||
            windowsDeviceId ||
            selected?.id;
          send(active, { type: 'ready', sessionId, cameraId: openedCameraId });
        },
        onText(text, generation) {
          if (generation === active.generation)
            send(active, { type: 'text', sessionId, text });
        },
        onError(error) {
          fail(active, cameraErrorCode(error.code));
        },
        onFrame(previewFrame) {
          void sendPreview(active, previewFrame);
        },
      });
      active.capture.start();
      return true;
    } catch {
      if (lease === active) stop();
      return false;
    }
  };

  ipcMain.removeHandler(desktopQrScannerChannel.start);
  ipcMain.handle(desktopQrScannerChannel.start, start);
  ipcMain.removeHandler(desktopQrScannerChannel.stop);
  ipcMain.handle(desktopQrScannerChannel.stop, (event, sessionId: unknown) => {
    if (trustedInvoke(event) && lease?.sessionId === sessionId) stop();
  });
  ipcMain.removeHandler(desktopQrScannerChannel.focus);
  ipcMain.handle(
    desktopQrScannerChannel.focus,
    (event, sessionId: unknown, x: unknown, y: unknown) => {
      const activeLease = lease;
      if (
        !trustedInvoke(event) ||
        !activeLease ||
        activeLease.sessionId !== sessionId ||
        activeLease.generation === undefined ||
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        return false;
      }
      const clampedX = Math.min(1, Math.max(0, x));
      const clampedY = Math.min(1, Math.max(0, y));
      if (typeof activeLease.capture?.focus === 'function') {
        try {
          return Boolean(activeLease.capture.focus(clampedX, clampedY));
        } catch {
          return false;
        }
      }
      return Boolean(activeLease.autoFocusSupported);
    },
  );
  ipcMain.removeHandler(desktopQrScannerChannel.listCameras);
  ipcMain.handle(desktopQrScannerChannel.listCameras, async (event) => {
    if (!trustedInvoke(event)) return null;
    const scanner = loadNativeScanner();
    if (!scanner) return null;
    try {
      return (await scanner.listCameras()).map<IDesktopQrCamera>((camera) => ({
        id: camera.id,
        label: camera.label ?? camera.name ?? camera.id,
        position: camera.position ?? (camera.isDefault ? 'back' : 'external'),
      }));
    } catch {
      return null;
    }
  });
  window.on('hide', stop);
  window.on('minimize', stop);
  window.on('closed', stop);
  window.webContents.on('render-process-gone', stop);
  window.webContents.on('did-start-navigation', (event) => {
    if (event.isMainFrame && !event.isSameDocument) stop();
  });
}
