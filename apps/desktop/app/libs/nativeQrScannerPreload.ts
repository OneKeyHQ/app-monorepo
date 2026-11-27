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
  const previews = new Map<
    string,
    {
      frozen: boolean;
      revision: number;
      drawnRevision?: number;
    }
  >();
  const installReceiver = () => {
    if (receiverInstalled) return;
    sharedTexture.setSharedTextureReceiver(
      async (
        { importedSharedTexture },
        sessionId: unknown,
        revision: unknown,
      ) => {
        try {
          if (typeof sessionId !== 'string') return;
          const preview = previews.get(sessionId);
          if (
            !preview ||
            preview.frozen ||
            (revision ?? 0) !== preview.revision
          )
            return;
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
            preview.drawnRevision = preview.revision;
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
    start: async (sessionId, cameraId, options) => {
      installReceiver();
      previews.set(sessionId, { frozen: false, revision: 0 });
      return ipcRenderer.invoke(
        desktopQrScannerChannel.start,
        sessionId,
        cameraId,
        options,
      ) as Promise<boolean>;
    },
    stop: (sessionId) => {
      previews.delete(sessionId);
      return ipcRenderer.invoke(
        desktopQrScannerChannel.stop,
        sessionId,
      ) as Promise<void>;
    },
    focus: (sessionId, x, y) =>
      ipcRenderer.invoke(
        desktopQrScannerChannel.focus,
        sessionId,
        x,
        y,
      ) as Promise<boolean>,
    setMultiSymbol: (sessionId, enabled) =>
      ipcRenderer.invoke(
        desktopQrScannerChannel.setMultiSymbol,
        sessionId,
        enabled,
      ) as Promise<void>,
    setPaused: (sessionId, paused, analysisRevision) =>
      ipcRenderer.invoke(
        desktopQrScannerChannel.setPaused,
        sessionId,
        paused,
        analysisRevision,
      ) as Promise<void>,
    setPreviewFrozen: (sessionId, frozen, revision) => {
      const preview = previews.get(sessionId);
      if (!preview) return;
      preview.frozen = frozen;
      if (revision !== undefined) preview.revision = revision;
    },
    hasFreshPreview: (sessionId, revision) => {
      const preview = previews.get(sessionId);
      return (
        preview?.revision === revision && preview.drawnRevision === revision
      );
    },
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
