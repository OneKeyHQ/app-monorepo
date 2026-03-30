/**
 * Minimal preload for the tray panel window.
 *
 * Only exposes the three IPC methods the tray renderer needs:
 *   - sendTrayData(data)    — respond to data requests from main process
 *   - sendTrayAction(action) — request navigation in main window
 *   - addIpcEventListener / removeIpcEventListener — subscribe to tray updates
 *
 * This is intentionally separate from the main preload.ts to avoid exposing
 * security-sensitive operations (app restart, boot count reset, etc.) to the
 * tray renderer which displays external market data.
 */
import { ipcRenderer } from 'electron';

const TRAY_CHANNELS = {
  DATA_RESPONSE: 'tray/dataResponse',
  ACTION: 'tray/action',
  UPDATE: 'tray/update',
} as const;

const ALLOWED_LISTEN_CHANNELS = new Set<string>([TRAY_CHANNELS.UPDATE]);

type IpcListener = (event: Electron.IpcRendererEvent, ...args: any[]) => void;

const trayApi = Object.freeze({
  sendTrayData: (data: unknown) => {
    ipcRenderer.send(TRAY_CHANNELS.DATA_RESPONSE, data);
  },
  sendTrayAction: (action: unknown) => {
    ipcRenderer.send(TRAY_CHANNELS.ACTION, action);
  },
  addIpcEventListener: (channel: string, listener: IpcListener) => {
    if (!ALLOWED_LISTEN_CHANNELS.has(channel)) return;
    ipcRenderer.on(channel, listener);
  },
  removeIpcEventListener: (channel: string, listener: IpcListener) => {
    if (!ALLOWED_LISTEN_CHANNELS.has(channel)) return;
    ipcRenderer.removeListener(channel, listener);
  },
});

// Match the main preload's contextIsolation: false pattern
(globalThis as any).desktopApi = trayApi;
