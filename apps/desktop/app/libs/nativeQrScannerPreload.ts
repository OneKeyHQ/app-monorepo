import { ipcRenderer, sharedTexture } from 'electron';

import {
  desktopQrPreviewPrefix,
  desktopQrScannerChannel,
} from '@onekeyhq/shared/types/desktopQrScanner';
import type {
  IDesktopQrEvent,
  IDesktopQrScanner,
} from '@onekeyhq/shared/types/desktopQrScanner';

export function createNativeQrScannerBridge(): IDesktopQrScanner | undefined {
  if (
    !process.isMainFrame ||
    (process.platform !== 'darwin' && process.platform !== 'win32') ||
    !sharedTexture
  )
    return undefined;

  let receiverInstalled = false;
  const installReceiver = () => {
    if (receiverInstalled) return;
    sharedTexture.setSharedTextureReceiver(
      async ({ importedSharedTexture }, sessionId: unknown) => {
        try {
          if (typeof sessionId !== 'string') return;
          const canvas = document.getElementById(
            desktopQrPreviewPrefix + sessionId,
          );
          if (!(canvas instanceof HTMLCanvasElement)) return;
          const frame = importedSharedTexture.getVideoFrame();
          try {
            const context = canvas.getContext('2d');
            if (!context) return;
            if (canvas.width !== frame.displayWidth)
              canvas.width = frame.displayWidth;
            if (canvas.height !== frame.displayHeight)
              canvas.height = frame.displayHeight;
            context.drawImage(frame, 0, 0, canvas.width, canvas.height);
          } finally {
            frame.close();
          }
        } finally {
          importedSharedTexture.release();
        }
      },
    );
    receiverInstalled = true;
  };

  return {
    listCameras: () =>
      ipcRenderer.invoke(desktopQrScannerChannel.listCameras) as ReturnType<
        IDesktopQrScanner['listCameras']
      >,
    start: async (sessionId, cameraId) => {
      installReceiver();
      return ipcRenderer.invoke(
        desktopQrScannerChannel.start,
        sessionId,
        cameraId,
      ) as Promise<boolean>;
    },
    stop: (sessionId) =>
      ipcRenderer.invoke(
        desktopQrScannerChannel.stop,
        sessionId,
      ) as Promise<void>,
    focus: (sessionId, x, y) =>
      ipcRenderer.invoke(
        desktopQrScannerChannel.focus,
        sessionId,
        x,
        y,
      ) as Promise<boolean>,
    onEvent: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        message: IDesktopQrEvent,
      ) => callback(message);
      ipcRenderer.on(desktopQrScannerChannel.event, listener);
      return () => {
        ipcRenderer.removeListener(desktopQrScannerChannel.event, listener);
      };
    },
  };
}
