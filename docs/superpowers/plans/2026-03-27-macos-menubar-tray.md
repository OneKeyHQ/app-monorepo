# macOS System Tray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a macOS menu bar tray icon that opens a read-only popover panel showing portfolio overview, watchlist tickers, and pending transaction status.

**Architecture:** Electron `Tray` API creates the icon. A frameless `BrowserWindow` serves as the popover panel, loading the same renderer entry with a `?render=tray` query parameter. Data flows from the main window's existing Jotai store through IPC to the tray panel. A 30-second independent polling timer in the main process drives data refresh and transaction notification diffs.

**Tech Stack:** Electron 39.5.1 Tray + BrowserWindow, React + Tamagui (shared with main app), Jotai atoms for state, Electron Notification API.

**Spec:** `docs/superpowers/specs/2026-03-27-macos-menubar-tray-design.md`

---

## File Structure

### New Files (Main Process)

| File | Responsibility |
|---|---|
| `apps/desktop/app/tray/TrayManager.ts` | Tray lifecycle: create icon, init polling timer, manage panel show/hide, destroy cleanup |
| `apps/desktop/app/tray/trayWindow.ts` | Create and position the panel BrowserWindow |
| `apps/desktop/app/tray/trayIpc.ts` | Register tray-specific IPC handlers, data request/response, navigation forwarding |
| `apps/desktop/app/tray/trayNotification.ts` | Diff pending txs between poll cycles, push macOS native notifications |

### New Files (Renderer)

Renderer components go in `packages/kit/src/views/Tray/` following the existing codebase convention where all UI views live in `packages/kit/src/views/`.

| File | Responsibility |
|---|---|
| `packages/kit/src/views/Tray/TrayPanel.tsx` | Panel root component — layout container with TamaguiProvider |
| `packages/kit/src/views/Tray/components/PortfolioOverview.tsx` | Wallet name, avatar, total balance, 24h change |
| `packages/kit/src/views/Tray/components/WatchlistTickers.tsx` | Favorited token list with prices and changes |
| `packages/kit/src/views/Tray/components/PendingTransactions.tsx` | Pending tx list with status labels |
| `packages/kit/src/views/Tray/components/TrayEmptyState.tsx` | Locked / no wallet / loading states |

### Shared Types

| File | Responsibility |
|---|---|
| `packages/shared/src/types/desktop/tray.ts` | `ITrayData`, `IPendingTx` interfaces shared between main process and renderer |

### New Assets

| File | Responsibility |
|---|---|
| `apps/desktop/public/static/images/trayTemplate.png` | 16x16 tray icon (macOS template image) |
| `apps/desktop/public/static/images/trayTemplate@2x.png` | 32x32 retina tray icon |

### Modified Files

| File | Change |
|---|---|
| `apps/desktop/app/config.ts` | Add tray IPC message keys |
| `apps/desktop/app/app.ts` | Init TrayManager after app ready (~line 1220 handler), cleanup in before-quit (~line 1258 handler) |
| `apps/desktop/app/preload.ts` | Add `sendTrayData` and `sendTrayAction` to `desktopApi` BEFORE `Object.freeze`, add tray channels to `validChannels` |
| `apps/desktop/App.tsx` | Detect `?render=tray` and render TrayPanel instead of main app |

---

## Task 1: Add Shared Types and IPC Message Keys

**Files:**
- Create: `packages/shared/src/types/desktop/tray.ts`
- Modify: `apps/desktop/app/config.ts`

- [ ] **Step 1: Create shared tray types**

```bash
mkdir -p packages/shared/src/types/desktop
```

Create `packages/shared/src/types/desktop/tray.ts`:

```typescript
export interface IPendingTx {
  id: string;
  type: 'send' | 'swap' | 'contract';
  to: string;
  amount: string;
  status: string;
  confirmations?: string;
}

export interface ITrayData {
  wallet: {
    name: string;
    avatar: string;
  };
  totalBalance: {
    amount: string;
    currency: string;
    change24h: number;
  };
  watchlist: Array<{
    symbol: string;
    name: string;
    icon: string;
    price: string;
    change24h: number;
  }>;
  pendingTxs: IPendingTx[];
}

// IPC channel constants (duplicated from config.ts for renderer access)
export const TRAY_IPC = {
  DATA_REQUEST: 'tray/dataRequest',
  DATA_RESPONSE: 'tray/dataResponse',
  UPDATE: 'tray/update',
  ACTION: 'tray/action',
} as const;
```

- [ ] **Step 2: Add tray IPC keys to ipcMessageKeys**

Open `apps/desktop/app/config.ts` and add at the end of the `ipcMessageKeys` object (before the closing `}`):

```typescript
  // Tray
  TRAY_DATA_REQUEST: 'tray/dataRequest',
  TRAY_DATA_RESPONSE: 'tray/dataResponse',
  TRAY_UPDATE: 'tray/update',
  TRAY_ACTION: 'tray/action',
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/desktop/tray.ts apps/desktop/app/config.ts
git commit -m "feat(desktop): add tray shared types and IPC message keys"
```

---

## Task 2: Create Tray Icon Assets

**Files:**
- Create: `apps/desktop/public/static/images/trayTemplate.png`
- Create: `apps/desktop/public/static/images/trayTemplate@2x.png`

- [ ] **Step 1: Generate template images**

Create macOS template images from the existing `512x512.png`. Template images must be grayscale with alpha channel — macOS renders them in menu bar style automatically.

```bash
# ImageMagick 7+:
magick apps/desktop/public/static/images/icons/512x512.png \
  -resize 16x16 -colorspace Gray \
  apps/desktop/public/static/images/trayTemplate.png

magick apps/desktop/public/static/images/icons/512x512.png \
  -resize 32x32 -colorspace Gray \
  apps/desktop/public/static/images/trayTemplate@2x.png
```

If ImageMagick is not available, use any image editor to create 16x16 and 32x32 grayscale PNG versions.

- [ ] **Step 2: Verify files exist**

```bash
ls -la apps/desktop/public/static/images/trayTemplate*.png
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/public/static/images/trayTemplate*.png
git commit -m "feat(desktop): add tray template icon assets"
```

---

## Task 3: Create trayWindow.ts — Panel BrowserWindow

**Files:**
- Create: `apps/desktop/app/tray/trayWindow.ts`

**Read first:**
- `apps/desktop/app/app.ts` lines 546-620 (main BrowserWindow creation + URL loading pattern)
- Find `getBundleIndexHtmlPath()` or `formatUrl()` usage for production URL resolution

- [ ] **Step 1: Create the tray directory**

```bash
mkdir -p apps/desktop/app/tray
```

- [ ] **Step 2: Write trayWindow.ts**

```typescript
import path from 'path';
import { BrowserWindow, type Tray, screen } from 'electron';
import isDev from 'electron-is-dev';

let trayWindow: BrowserWindow | null = null;

function calculateWindowPosition(
  tray: Tray,
  windowWidth: number,
  windowHeight: number,
): { x: number; y: number } {
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });
  const displayBounds = display.workArea;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowWidth / 2);
  const y = Math.round(trayBounds.y + trayBounds.height);

  // Prevent overflow on the right edge
  if (x + windowWidth > displayBounds.x + displayBounds.width) {
    x = displayBounds.x + displayBounds.width - windowWidth;
  }
  // Prevent overflow on the left edge
  if (x < displayBounds.x) {
    x = displayBounds.x;
  }

  return { x, y };
}

export function createTrayWindow(
  tray: Tray,
  loadUrl: (win: BrowserWindow) => void,
): BrowserWindow {
  if (trayWindow && !trayWindow.isDestroyed()) {
    return trayWindow;
  }

  const WINDOW_WIDTH = 360;
  const WINDOW_HEIGHT = 480;
  const { x, y } = calculateWindowPosition(tray, WINDOW_WIDTH, WINDOW_HEIGHT);

  trayWindow = new BrowserWindow({
    x,
    y,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      spellcheck: false,
      webviewTag: false,
      webSecurity: !isDev,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      nodeIntegration: false,
    },
  });

  // Load URL — caller provides the correct URL resolution
  loadUrl(trayWindow);

  // Hide on blur with delay to check if main window got focus
  trayWindow.on('blur', () => {
    setTimeout(() => {
      if (trayWindow && !trayWindow.isDestroyed() && !trayWindow.isFocused()) {
        trayWindow.hide();
      }
    }, 100);
  });

  // Escape key hides the panel
  trayWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      trayWindow?.hide();
    }
  });

  return trayWindow;
}

export function showTrayWindow(tray: Tray): void {
  if (!trayWindow || trayWindow.isDestroyed()) {
    return; // Window must be created first via createTrayWindow
  }

  if (trayWindow.isVisible()) {
    trayWindow.hide();
    return;
  }

  // Recalculate position every time (handles display changes, tray repositioning)
  const { x, y } = calculateWindowPosition(tray, 360, 480);
  trayWindow.setPosition(x, y);
  trayWindow.show();
}

export function hideTrayWindow(): void {
  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.hide();
  }
}

export function getTrayWindow(): BrowserWindow | null {
  if (trayWindow && !trayWindow.isDestroyed()) {
    return trayWindow;
  }
  return null;
}

export function destroyTrayWindow(): void {
  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.destroy();
  }
  trayWindow = null;
}
```

Key design decisions:
- `loadUrl` is a callback so `TrayManager` can pass the correct URL resolution (same pattern as main window, with `?render=tray` appended).
- Escape key handled via `webContents.on('before-input-event')` — spec requirement.
- Position recalculated on every show — spec requirement.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/app/tray/trayWindow.ts
git commit -m "feat(desktop): add tray panel BrowserWindow with positioning and Escape handling"
```

---

## Task 4: Create trayNotification.ts

**Files:**
- Create: `apps/desktop/app/tray/trayNotification.ts`

- [ ] **Step 1: Write trayNotification.ts**

```typescript
import { Notification } from 'electron';
import type { IPendingTx } from '@onekeyhq/shared/src/types/desktop/tray';

let previousPendingTxs: IPendingTx[] = [];
let notificationClickHandler: ((txId: string) => void) | null = null;

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function diffAndNotify(currentTxs: IPendingTx[]): void {
  if (!Notification.isSupported()) {
    previousPendingTxs = currentTxs;
    return;
  }

  for (const prevTx of previousPendingTxs) {
    const currentTx = currentTxs.find((tx) => tx.id === prevTx.id);

    // Transaction was pending and is now gone (likely confirmed)
    if (!currentTx && prevTx.status === 'pending') {
      const notification = new Notification({
        title: 'Transaction Confirmed',
        body: `${prevTx.amount} → ${truncateAddress(prevTx.to)}`,
        silent: false,
      });
      notification.on('click', () => {
        notificationClickHandler?.(prevTx.id);
      });
      notification.show();
    }

    // Transaction status changed to failed
    if (currentTx && currentTx.status === 'failed' && prevTx.status !== 'failed') {
      const notification = new Notification({
        title: 'Transaction Failed',
        body: `${prevTx.amount} → ${truncateAddress(prevTx.to)}`,
        silent: false,
      });
      notification.on('click', () => {
        notificationClickHandler?.(prevTx.id);
      });
      notification.show();
    }
  }

  previousPendingTxs = currentTxs;
}

export function setNotificationClickHandler(
  handler: (txId: string) => void,
): void {
  notificationClickHandler = handler;
}

export function resetNotificationState(): void {
  previousPendingTxs = [];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/app/tray/trayNotification.ts
git commit -m "feat(desktop): add transaction status diff and notification logic"
```

---

## Task 5: Create trayIpc.ts — IPC Handlers

**Files:**
- Create: `apps/desktop/app/tray/trayIpc.ts`

- [ ] **Step 1: Write trayIpc.ts**

```typescript
import { type BrowserWindow, ipcMain } from 'electron';
import { ipcMessageKeys } from '../config';
import { getTrayWindow } from './trayWindow';
import { diffAndNotify } from './trayNotification';
import type { ITrayData } from '@onekeyhq/shared/src/types/desktop/tray';

let cachedTrayData: ITrayData | null = null;
let isLocked = false;

export function getCachedTrayData(): ITrayData | null {
  return cachedTrayData;
}

export function setLocked(locked: boolean): void {
  isLocked = locked;
}

export function registerTrayIpcHandlers(
  getMainWindow: () => BrowserWindow | undefined,
  showMainWindow: () => void,
): void {
  // Main window renderer responds with data
  ipcMain.on(ipcMessageKeys.TRAY_DATA_RESPONSE, (_event, data: ITrayData) => {
    cachedTrayData = data;

    // Diff pending txs and push notifications (suppressed when locked)
    if (!isLocked) {
      diffAndNotify(data.pendingTxs);
    }

    // Forward to tray panel if open
    const trayWindow = getTrayWindow();
    if (trayWindow) {
      trayWindow.webContents.send(ipcMessageKeys.TRAY_UPDATE, data);
    }
  });

  // Tray panel requests navigation to main window
  ipcMain.on(
    ipcMessageKeys.TRAY_ACTION,
    (_event, action: { type: string; route?: string; txId?: string }) => {
      showMainWindow();

      if (action.type === 'open-page' && action.route) {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(ipcMessageKeys.EVENT_OPEN_URL, {
            url: action.route,
          });
        }
      }
    },
  );
}

export function requestDataFromMainWindow(
  getMainWindow: () => BrowserWindow | undefined,
): void {
  if (isLocked) return;

  const mainWindow = getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isCrashed()) return;

  mainWindow.webContents.send(ipcMessageKeys.TRAY_DATA_REQUEST);
  // 5s timeout: no explicit handler needed — panel always renders cachedTrayData.
  // If no response arrives, stale data is shown (already handled in renderer).
}

export function unregisterTrayIpcHandlers(): void {
  ipcMain.removeAllListeners(ipcMessageKeys.TRAY_DATA_RESPONSE);
  ipcMain.removeAllListeners(ipcMessageKeys.TRAY_ACTION);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/app/tray/trayIpc.ts
git commit -m "feat(desktop): add tray IPC handlers for data flow and navigation"
```

---

## Task 6: Create TrayManager.ts — Core Lifecycle

**Files:**
- Create: `apps/desktop/app/tray/TrayManager.ts`

**Read first:**
- `apps/desktop/app/app.ts` — find how the main window loads its URL in dev vs production. Look for `loadURL` / `loadFile` / `formatUrl` / `getBundleIndexHtmlPath`. The tray window must use the same URL resolution pattern, appending `?render=tray`.

- [ ] **Step 1: Write TrayManager.ts**

```typescript
import path from 'path';
import { type BrowserWindow, Tray, nativeImage } from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log';

import { ipcMessageKeys } from '../config';
import { createTrayWindow, showTrayWindow, destroyTrayWindow } from './trayWindow';
import {
  registerTrayIpcHandlers,
  requestDataFromMainWindow,
  unregisterTrayIpcHandlers,
  setLocked,
} from './trayIpc';
import { setNotificationClickHandler, resetNotificationState } from './trayNotification';

const POLL_INTERVAL_MS = 30_000;

let tray: Tray | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;

export function initTrayManager(
  getMainWindow: () => BrowserWindow | undefined,
  showMainWindow: () => void,
  appStaticResourcesPath: string,
  // Caller provides URL loading logic so tray uses same pattern as main window
  loadTrayUrl: (win: BrowserWindow) => void,
): void {
  if (isInitialized) return;

  logger.info('[TrayManager] Initializing macOS system tray');

  // Create tray icon
  const iconPath = path.join(appStaticResourcesPath, 'images', 'trayTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('OneKey');

  // Lazy-create panel window on first click
  let panelCreated = false;

  const handleClick = () => {
    if (!tray) return;
    if (!panelCreated) {
      createTrayWindow(tray, loadTrayUrl);
      panelCreated = true;
    }
    showTrayWindow(tray);
  };

  tray.on('click', handleClick);
  tray.on('right-click', handleClick);

  // Register IPC handlers
  registerTrayIpcHandlers(getMainWindow, showMainWindow);

  // Notification click → navigate main window to tx detail
  setNotificationClickHandler((txId: string) => {
    showMainWindow();
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(ipcMessageKeys.EVENT_OPEN_URL, {
        url: `onekey-wallet://transaction/${txId}`,
      });
    }
  });

  isInitialized = true;
  logger.info('[TrayManager] macOS system tray initialized');
}

export function startPolling(
  getMainWindow: () => BrowserWindow | undefined,
): void {
  if (pollTimer) return;

  logger.info('[TrayManager] Starting data polling (30s interval)');

  // Initial fetch
  requestDataFromMainWindow(getMainWindow);

  pollTimer = setInterval(() => {
    requestDataFromMainWindow(getMainWindow);
  }, POLL_INTERVAL_MS);
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function setTrayLocked(locked: boolean): void {
  setLocked(locked);
  if (locked) {
    stopPolling();
    resetNotificationState();
  }
  // Caller is responsible for calling startPolling() again when unlocked
}

export function destroyTrayManager(): void {
  logger.info('[TrayManager] Destroying system tray');

  stopPolling();
  unregisterTrayIpcHandlers();
  destroyTrayWindow();
  resetNotificationState();

  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
  isInitialized = false;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/app/tray/TrayManager.ts
git commit -m "feat(desktop): add TrayManager lifecycle orchestration"
```

---

## Task 7: Integrate TrayManager into app.ts

**Files:**
- Modify: `apps/desktop/app/app.ts`

**Read first:** The entire file to locate:
- `isMac` constant (~line 150)
- `getSafelyMainWindow()` function
- `showMainWindow()` function
- `app.on('ready', ...)` handler (~line 1220, the one containing `startServices()`)
- `ipcMain.on(ipcMessageKeys.APP_READY, ...)` handler (~line 753, the FIRST one — not the relaunch one)
- `app.on('before-quit', ...)` handler (~line 1258)
- The main window URL loading code (dev vs production) to replicate for tray

- [ ] **Step 1: Add import at the top of app.ts**

```typescript
import {
  initTrayManager,
  startPolling,
  destroyTrayManager,
} from './tray/TrayManager';
```

- [ ] **Step 2: Initialize TrayManager in the `app.on('ready')` handler at ~line 1220**

After the main window is created and menu is set, add:

```typescript
if (isMac) {
  initTrayManager(
    getSafelyMainWindow,
    showMainWindow,
    appStaticResourcesPath, // use the exact variable name from app.ts
    (win) => {
      // Use same URL loading pattern as main window, with ?render=tray
      if (isDev) {
        const port = process.env.PORT || 3001;
        void win.loadURL(`http://localhost:${port}?render=tray`);
      } else {
        // Match main window's production URL resolution
        // Use getBundleIndexHtmlPath() / formatUrl() same as main window
        // Append ?render=tray query parameter
        // IMPLEMENTER: read how mainWindow loads its URL and replicate here
      }
    },
  );
}
```

- [ ] **Step 3: Start polling when APP_READY fires**

In the FIRST `ipcMain.on(ipcMessageKeys.APP_READY, ...)` handler (~line 753), add:

```typescript
if (isMac) {
  startPolling(getSafelyMainWindow);
}
```

- [ ] **Step 4: Cleanup in `app.on('before-quit')` handler at ~line 1258**

Add at the beginning of the handler:

```typescript
if (isMac) {
  destroyTrayManager();
}
```

- [ ] **Step 5: Verify the app starts without errors**

```bash
yarn app:desktop
```

Expected: App launches normally. OneKey icon appears in macOS menu bar.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/app/app.ts
git commit -m "feat(desktop): integrate TrayManager into app lifecycle"
```

---

## Task 8: Update preload.ts for Tray IPC

**Files:**
- Modify: `apps/desktop/app/preload.ts`

**Read first:** `apps/desktop/app/preload.ts` — understand:
- Where `desktopApi` object is defined (before `Object.freeze`)
- Where `validChannels` set is defined
- The `IDesktopAPILegacy` interface
- How `addIpcEventListener` / `removeIpcEventListener` work

- [ ] **Step 1: Add tray channels to `validChannels`**

Find the `validChannels` set and add:

```typescript
ipcMessageKeys.TRAY_DATA_REQUEST,
ipcMessageKeys.TRAY_UPDATE,
```

- [ ] **Step 2: Add tray methods to `desktopApi` BEFORE `Object.freeze`**

Find where the `desktopApi` object is constructed (before the `Object.freeze` call). Add these methods:

```typescript
sendTrayData: (data: any) => ipcRenderer.send(ipcMessageKeys.TRAY_DATA_RESPONSE, data),
sendTrayAction: (action: any) => ipcRenderer.send(ipcMessageKeys.TRAY_ACTION, action),
```

- [ ] **Step 3: Add tray data request listener**

Add this BEFORE the `Object.freeze` call:

```typescript
// Forward tray data requests to renderer via custom event
ipcRenderer.on(ipcMessageKeys.TRAY_DATA_REQUEST, () => {
  window.dispatchEvent(new Event('onekey-tray-data-request'));
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/app/preload.ts
git commit -m "feat(desktop): add tray IPC methods to preload desktopApi"
```

---

## Task 9: Create Tray Panel Renderer Components

**Files:**
- Create: `packages/kit/src/views/Tray/components/TrayEmptyState.tsx`
- Create: `packages/kit/src/views/Tray/components/PortfolioOverview.tsx`
- Create: `packages/kit/src/views/Tray/components/WatchlistTickers.tsx`
- Create: `packages/kit/src/views/Tray/components/PendingTransactions.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p packages/kit/src/views/Tray/components
```

- [ ] **Step 2: Write TrayEmptyState.tsx**

```tsx
import { Stack, Text } from '@onekeyhq/components';

type IEmptyStateType = 'loading' | 'locked' | 'noWallet' | 'offline';

const MESSAGES: Record<IEmptyStateType, { title: string; subtitle: string }> = {
  loading: { title: 'Loading...', subtitle: 'Connecting to OneKey' },
  locked: { title: 'App is Locked', subtitle: 'Click to unlock' },
  noWallet: { title: 'No Wallet', subtitle: 'Create or import a wallet in the app' },
  offline: { title: 'Network Unavailable', subtitle: 'Showing cached data' },
};

export function TrayEmptyState({
  type,
  onPress,
}: {
  type: IEmptyStateType;
  onPress?: () => void;
}) {
  const message = MESSAGES[type];
  return (
    <Stack
      flex={1}
      alignItems="center"
      justifyContent="center"
      padding="$4"
      onPress={onPress}
      cursor={onPress ? 'pointer' : 'default'}
    >
      <Text fontSize="$headingMd" color="$text" marginBottom="$2">
        {message.title}
      </Text>
      <Text fontSize="$bodySm" color="$textSubdued">
        {message.subtitle}
      </Text>
    </Stack>
  );
}
```

- [ ] **Step 3: Write PortfolioOverview.tsx**

```tsx
import { Stack, Text } from '@onekeyhq/components';

export function PortfolioOverview({
  wallet,
  totalBalance,
  onPress,
}: {
  wallet: { name: string; avatar: string };
  totalBalance: { amount: string; currency: string; change24h: number };
  onPress: () => void;
}) {
  const isPositive = totalBalance.change24h >= 0;
  const changeColor = isPositive ? '$textSuccess' : '$textCritical';
  const changePrefix = isPositive ? '+' : '';

  return (
    <Stack
      padding="$4"
      borderBottomWidth={1}
      borderBottomColor="$borderSubdued"
      onPress={onPress}
      cursor="pointer"
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      <Text fontSize="$bodySm" color="$textSubdued" marginBottom="$1">
        {wallet.name}
      </Text>
      <Text fontSize="$headingXl" color="$text" fontWeight="600">
        {totalBalance.currency === 'USD' ? '$' : ''}{totalBalance.amount}
      </Text>
      <Text fontSize="$bodySm" color={changeColor} marginTop="$1">
        {changePrefix}{totalBalance.change24h.toFixed(2)}%
      </Text>
    </Stack>
  );
}
```

- [ ] **Step 4: Write WatchlistTickers.tsx**

```tsx
import { Stack, Text } from '@onekeyhq/components';

interface ITicker {
  symbol: string;
  name: string;
  icon: string;
  price: string;
  change24h: number;
}

function TickerRow({ ticker, onPress }: { ticker: ITicker; onPress: () => void }) {
  const isPositive = ticker.change24h >= 0;
  const changeColor = isPositive ? '$textSuccess' : '$textCritical';
  const changePrefix = isPositive ? '+' : '';

  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      paddingHorizontal="$4"
      paddingVertical="$2.5"
      onPress={onPress}
      cursor="pointer"
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      <Stack flex={1}>
        <Text fontSize="$bodyMd" color="$text">{ticker.symbol}</Text>
        <Text fontSize="$bodySm" color="$textSubdued">{ticker.name}</Text>
      </Stack>
      <Stack alignItems="flex-end">
        <Text fontSize="$bodyMd" color="$text">{ticker.price}</Text>
        <Text fontSize="$bodySm" color={changeColor}>
          {changePrefix}{ticker.change24h.toFixed(2)}%
        </Text>
      </Stack>
    </Stack>
  );
}

export function WatchlistTickers({
  tickers,
  onTickerPress,
}: {
  tickers: ITicker[];
  onTickerPress: (symbol: string) => void;
}) {
  if (!tickers || tickers.length === 0) {
    return (
      <Stack padding="$4">
        <Text fontSize="$bodySm" color="$textSubdued" textAlign="center">
          Add favorites in the app
        </Text>
      </Stack>
    );
  }

  return (
    <Stack>
      <Text fontSize="$bodySm" color="$textSubdued" paddingHorizontal="$4" paddingTop="$3" paddingBottom="$1">
        Watchlist
      </Text>
      {tickers.map((ticker) => (
        <TickerRow key={ticker.symbol} ticker={ticker} onPress={() => onTickerPress(ticker.symbol)} />
      ))}
    </Stack>
  );
}
```

- [ ] **Step 5: Write PendingTransactions.tsx**

```tsx
import { Stack, Text } from '@onekeyhq/components';
import type { IPendingTx } from '@onekeyhq/shared/src/types/desktop/tray';

const TX_TYPE_LABELS: Record<string, string> = {
  send: 'Send',
  swap: 'Swap',
  contract: 'Contract',
};

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function TxRow({ tx, onPress }: { tx: IPendingTx; onPress: () => void }) {
  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      paddingHorizontal="$4"
      paddingVertical="$2.5"
      onPress={onPress}
      cursor="pointer"
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      <Stack flex={1}>
        <Text fontSize="$bodyMd" color="$text">{TX_TYPE_LABELS[tx.type] || tx.type}</Text>
        <Text fontSize="$bodySm" color="$textSubdued">→ {truncateAddress(tx.to)}</Text>
      </Stack>
      <Stack alignItems="flex-end">
        <Text fontSize="$bodyMd" color="$text">{tx.amount}</Text>
        <Text fontSize="$bodySm" color="$textWarning">{tx.confirmations || 'Pending'}</Text>
      </Stack>
    </Stack>
  );
}

export function PendingTransactions({
  transactions,
  onTxPress,
}: {
  transactions: IPendingTx[];
  onTxPress: (txId: string) => void;
}) {
  if (!transactions || transactions.length === 0) {
    return (
      <Stack padding="$4">
        <Text fontSize="$bodySm" color="$textSubdued" textAlign="center">
          No pending transactions
        </Text>
      </Stack>
    );
  }

  const displayTxs = transactions.slice(0, 5);
  const hasMore = transactions.length > 5;

  return (
    <Stack>
      <Text fontSize="$bodySm" color="$textSubdued" paddingHorizontal="$4" paddingTop="$3" paddingBottom="$1">
        Pending Transactions
      </Text>
      {displayTxs.map((tx) => (
        <TxRow key={tx.id} tx={tx} onPress={() => onTxPress(tx.id)} />
      ))}
      {hasMore ? (
        <Stack padding="$3" onPress={() => onTxPress('')} cursor="pointer">
          <Text fontSize="$bodySm" color="$textInteractive" textAlign="center">View all →</Text>
        </Stack>
      ) : null}
    </Stack>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/kit/src/views/Tray/
git commit -m "feat(desktop): add tray panel UI components"
```

---

## Task 10: Create TrayPanel Root Component

**Files:**
- Create: `packages/kit/src/views/Tray/TrayPanel.tsx`

**Read first:**
- Find how Tamagui provider is set up in the main app. Look for `TamaguiProvider` usage in `packages/kit/src/provider/` or similar. The tray panel needs a minimal version of this provider.
- Find the Tamagui config import path (likely `@onekeyhq/components` exports it).

- [ ] **Step 1: Write TrayPanel.tsx**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Stack } from '@onekeyhq/components';
import { TRAY_IPC, type ITrayData } from '@onekeyhq/shared/src/types/desktop/tray';
import { TrayEmptyState } from './components/TrayEmptyState';
import { PortfolioOverview } from './components/PortfolioOverview';
import { WatchlistTickers } from './components/WatchlistTickers';
import { PendingTransactions } from './components/PendingTransactions';

function sendTrayAction(action: { type: string; route?: string }) {
  (globalThis as any).desktopApi?.sendTrayAction(action);
}

export function TrayPanel() {
  const [data, setData] = useState<ITrayData | null>(null);

  useEffect(() => {
    const handler = (_event: any, trayData: ITrayData) => {
      setData(trayData);
    };

    // Listen for data updates from main process via desktopApi
    (globalThis as any).desktopApi?.addIpcEventListener(TRAY_IPC.UPDATE, handler);

    return () => {
      (globalThis as any).desktopApi?.removeIpcEventListener(TRAY_IPC.UPDATE, handler);
    };
  }, []);

  const handleNavigate = useCallback((route: string) => {
    sendTrayAction({ type: 'open-page', route });
  }, []);

  if (!data) {
    return <TrayEmptyState type="loading" />;
  }

  if (!data.wallet?.name) {
    return <TrayEmptyState type="noWallet" />;
  }

  return (
    <Stack flex={1} backgroundColor="$bgApp" borderRadius="$3" overflow="hidden">
      <PortfolioOverview
        wallet={data.wallet}
        totalBalance={data.totalBalance}
        onPress={() => handleNavigate('/main/tab-home')}
      />
      <ScrollView flex={1}>
        <WatchlistTickers
          tickers={data.watchlist}
          onTickerPress={(symbol) => handleNavigate(`/market/token-detail/${symbol}`)}
        />
        <PendingTransactions
          transactions={data.pendingTxs}
          onTxPress={(txId) => handleNavigate(`/transaction/${txId}`)}
        />
      </ScrollView>
    </Stack>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/kit/src/views/Tray/TrayPanel.tsx
git commit -m "feat(desktop): add TrayPanel root component"
```

---

## Task 11: Update App Entry to Route Tray Panel

**Files:**
- Modify: `apps/desktop/App.tsx`

**Read first:** `apps/desktop/App.tsx` to understand current structure.

- [ ] **Step 1: Add tray panel detection and rendering**

Add at the top of App.tsx:

```tsx
import { TrayPanel } from '@onekeyhq/kit/src/views/Tray/TrayPanel';
```

In the App component, before the normal return, add:

```tsx
export default function App(props: any) {
  // Check if this is the tray panel window
  const isTrayPanel =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('render') === 'tray';

  if (isTrayPanel) {
    // Render tray panel with minimal provider (Tamagui theme only)
    // IMPLEMENTER: Wrap in TamaguiProvider with the correct config
    // Look at how KitProvider sets up Tamagui and extract the minimal setup
    return <TrayPanel />;
  }

  return <SentryKitProvider {...props} />;
}
```

**Important:** The tray panel MUST be wrapped in a `TamaguiProvider` for theme tokens (`$bgApp`, `$text`, `$textSubdued` etc.) to resolve. Find how the main app's `KitProvider` sets up Tamagui and replicate the minimal provider wrapper here.

- [ ] **Step 2: Ensure TrayPanel does NOT send APP_READY**

Verify that the `TrayPanel` code path does not call `desktopApi.ready()`. The `APP_READY` signal should only be sent by the main app. Since `TrayPanel` renders instead of `KitProvider`, this should be safe — but verify by searching for `desktopApi.ready()` calls.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/App.tsx
git commit -m "feat(desktop): route tray panel via ?render=tray query parameter"
```

---

## Task 12: Wire Up Tray Data Provider in Main Window

**Files:**
- Create: `packages/kit/src/hooks/useTrayDataProvider.ts`
- Modify: Mount the hook in main app root (location TBD — find existing platform-specific hook mounting point)

**Read first:**
- `packages/kit-bg/src/states/jotai/atoms/activeAccountValue.ts` — active account balance
- Search for wallet name/avatar atoms in `packages/kit/src/hooks/useAccountData.ts`
- Search for market watchlist atoms in `packages/kit/src/states/jotai/contexts/marketV2/`
- Search for pending transaction data

- [ ] **Step 1: Create useTrayDataProvider.ts scaffold**

Create `packages/kit/src/hooks/useTrayDataProvider.ts`:

```typescript
import { useEffect, useCallback } from 'react';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * This hook runs in the MAIN WINDOW renderer only (desktop platform).
 * It listens for data requests from the tray main process
 * and responds with current data from the Jotai store.
 *
 * TODO: Wire up actual data sources:
 * - Wallet name/avatar: from active wallet atom
 * - Total balance: from activeAccountValueAtom
 * - Watchlist: from market favorites atoms
 * - Pending transactions: from transaction history atoms
 */
export function useTrayDataProvider() {
  const handleTrayDataRequest = useCallback(() => {
    // Scaffold data — replace with actual store reads
    const trayData = {
      wallet: {
        name: 'My Wallet', // TODO: read from active wallet atom
        avatar: '',
      },
      totalBalance: {
        amount: '0.00', // TODO: read from activeAccountValueAtom
        currency: 'USD',
        change24h: 0,
      },
      watchlist: [], // TODO: read from market favorites
      pendingTxs: [], // TODO: read from pending tx state
    };

    (globalThis as any).desktopApi?.sendTrayData(trayData);
  }, []);

  useEffect(() => {
    // Only run on desktop
    if (!platformEnv.isDesktop) return;

    window.addEventListener('onekey-tray-data-request', handleTrayDataRequest);
    return () => {
      window.removeEventListener('onekey-tray-data-request', handleTrayDataRequest);
    };
  }, [handleTrayDataRequest]);
}
```

- [ ] **Step 2: Mount the hook**

Find where platform-specific hooks are mounted in the main app (likely in `packages/kit/src/provider/` or a root component). Add:

```typescript
import { useTrayDataProvider } from '../hooks/useTrayDataProvider';

// Inside the component:
useTrayDataProvider();
```

- [ ] **Step 3: Commit**

```bash
git add packages/kit/src/hooks/useTrayDataProvider.ts
git commit -m "feat(desktop): add tray data provider hook (scaffold)"
```

---

## Task 13: Manual Integration Testing

- [ ] **Step 1: Start the desktop app**

```bash
yarn app:desktop
```

- [ ] **Step 2: Verify tray icon appears in macOS menu bar**

- [ ] **Step 3: Click the tray icon — panel should appear below it (360x480)**

- [ ] **Step 4: Click outside the panel — should hide**

- [ ] **Step 5: Open panel and press Escape — should hide**

- [ ] **Step 6: Click a panel item — should open/focus main window**

- [ ] **Step 7: Close main window (Cmd+W) — tray icon should persist**

Note: Existing `quitOrMinimizeApp()` on macOS hides the window, does not quit. Tray should remain.

- [ ] **Step 8: Quit the app (Cmd+Q) — tray icon should disappear, clean shutdown**

- [ ] **Step 9: Commit any fixes**

```bash
git add -A
git commit -m "fix(desktop): integration test fixes for tray feature"
```

---

## Follow-Up Tasks (Not in This Plan)

These require deeper exploration of the data layer and are best done as a second iteration:

1. **Wire actual wallet data** — Replace scaffold in `useTrayDataProvider` with real active wallet name, avatar, and total balance from Jotai atoms
2. **Wire watchlist data** — Read market favorites from `marketV2` context atoms
3. **Wire pending transactions** — Read pending tx state from transaction history atoms
4. **Theme change listening** — Add `nativeTheme.on('updated')` to forward theme changes to tray panel
5. **Unlock restart polling** — Wire `setTrayLocked(false)` + `startPolling()` when user unlocks the app
6. **Stale data indicator** — Show "last updated X ago" in panel UI when data is stale
