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
  // --- Tray-specific methods ---
  sendTrayData: (data: unknown) => {
    ipcRenderer.send(TRAY_CHANNELS.DATA_RESPONSE, data);
  },
  sendTrayAction: (action: unknown) => {
    ipcRenderer.send(TRAY_CHANNELS.ACTION, action);
  },

  // --- IPC event listeners (tray channels + app state) ---
  addIpcEventListener: (channel: string, listener: IpcListener) => {
    if (ALLOWED_LISTEN_CHANNELS.has(channel)) {
      ipcRenderer.on(channel, listener);
    }
  },
  removeIpcEventListener: (channel: string, listener: IpcListener) => {
    if (ALLOWED_LISTEN_CHANNELS.has(channel)) {
      ipcRenderer.removeListener(channel, listener);
    }
  },

  // --- Stubs required by app bundle initialization ---
  // useVisibilityChange.ts calls these during component tree setup
  isFocused: () => true,
  onAppState: (_cb: (state: string) => void) => () => {},
  // Logger reads these synchronously at module load
  platform: process.platform,
  systemVersion: process.getSystemVersion(),
  arch: process.arch,
  isDev: process.env.NODE_ENV !== 'production',
  // on() is used by various listeners (auto-update, shortcuts, etc.)
  on: (_channel: string, _cb: (...args: any[]) => void) => () => {},
  // Misc stubs to prevent crashes during bundle init
  ready: () => {},
  deskChannel: '',
  isMas: process.mas,
  channel: '',
});

// Match the main preload's contextIsolation: false pattern
(globalThis as any).desktopApi = trayApi;

// Expose synchronous MMKV IPC bridge — required by the app bundle's storage
// initialization (syncStorageInstance.desktop.ts). Without this the tray
// renderer crashes before React can mount.
(globalThis as any).$mmkvSync = (args: {
  method: string;
  id: string;
  key?: string;
  value?: unknown;
}) => ipcRenderer.sendSync('mmkv:sync', args);
