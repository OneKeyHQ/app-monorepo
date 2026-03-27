# macOS System Tray (Menu Bar) Design Spec

## Overview

Add a macOS System Tray icon to the OneKey desktop app. Clicking the icon opens a read-only popover panel that shows portfolio overview, watchlist ticker prices, and pending transaction status. The Tray is an auxiliary entry point — it does not replace the main window and does not change existing close/quit behavior.

## Scope

- **Platform**: macOS only. Windows/Linux are not affected.
- **Interaction model**: Read-only. All items are clickable but only to open/navigate the main window. No in-panel actions (no send, no approve, no swap).
- **Data source**: Current active wallet/account only.

## Architecture

### File Structure

**Main process** — new module `apps/desktop/app/tray/`:

```
apps/desktop/app/tray/
  ├── TrayManager.ts       # Tray lifecycle, icon, panel window show/hide
  ├── trayWindow.ts        # BrowserWindow creation and positioning
  └── trayIpc.ts           # IPC handlers for data polling and notifications
```

**Renderer** — new panel entry routed separately from the main window:

```
apps/desktop/src/tray/
  └── TrayPanel.tsx         # Panel root component (React + Tamagui)
```

### Lifecycle

- `TrayManager` is initialized in `app.ts` after `app.whenReady()`, gated by `isMac`.
- The Tray icon is created at app startup and destroyed at app quit.
- The panel BrowserWindow is lazily created on first click, then reused via show/hide (never destroyed and recreated).

## Tray Icon

- macOS template image (`trayTemplate.png` 16x16 + `trayTemplate@2x.png` 32x32) placed in `apps/desktop/public/static/images/`.
- Template images automatically adapt to macOS light/dark menu bar.
- Left click toggles panel visibility. Right click behaves the same as left click.

## Panel Window

### BrowserWindow Configuration

| Property | Value |
|---|---|
| width | 360px |
| height | 480px |
| frame | false |
| transparent | true (CSS handles rounded corners) |
| resizable | false |
| movable | false |
| skipTaskbar | true |
| minimizable | false |
| maximizable | false |
| fullscreenable | false |
| show | false (shown on demand) |

### Positioning

- Horizontal: centered under the Tray icon, derived from `tray.getBounds()`.
- Vertical: directly below the macOS menu bar.
- Screen edge overflow: if the panel would extend beyond the right edge of the screen, shift left to stay within bounds.

### Show/Hide Behavior

- Click Tray icon: toggle visibility.
- Panel `blur` event: hide panel.
- `Escape` key within panel: hide panel.
- Main window gaining focus does NOT hide the panel.

## Panel UI Layout

The panel has three vertically stacked sections. The panel is scrollable if content overflows.

### 1. Portfolio Overview (top, fixed)

- Current wallet name + avatar
- Total balance in fiat (follows main app currency setting)
- 24h change percentage (green for positive, red for negative)
- Click anywhere in this section → open main window, navigate to portfolio page

### 2. Watchlist Tickers (middle, scrollable)

- List of user's favorited tokens from the main app
- Each row: token icon | name/symbol | current price | 24h change %
- Empty state: "Add favorites in the app" message
- Click a row → open main window, navigate to that token's detail page

### 3. Pending Transactions (bottom, scrollable)

- List of in-flight transactions for the current wallet
- Each row: tx type icon (send/swap/contract) | target address (truncated) | amount | status label (Pending / Confirming x/n)
- Empty state: "No pending transactions"
- Show at most 5 recent pending txs. If more, show "View all →"
- Click a row → open main window, navigate to that transaction's detail page

### Visual Style

- Follows main app theme (dark/light)
- Compact typography (one step smaller than main app)
- No action buttons — every interactive element is a navigation link

## Data Flow & IPC

### Polling

- `TrayManager` runs an independent 30-second polling timer.
- Polling does NOT stop when the panel is hidden (needed for transaction status monitoring and notifications).
- Polling pauses when the app is locked or no wallet exists.

### Data Path

```
Main Window Renderer (data source)
    ↓  ipcRenderer.on('tray-data-request')
    ↓  Reads from existing Redux/store
    ↓  ipcRenderer.send('tray-data-response', data)
Main Process (TrayManager)
    ↓  ipcMain receives data
    ↓  Sends to panel: panelWebContents.send('tray-update', data)
Tray Panel Renderer (display layer)
```

The Tray does NOT make its own API calls. It reads from the main window's existing data layer. If the main window's data is stale, the request triggers an incremental refresh.

### Data Structure

```typescript
interface TrayData {
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
  pendingTxs: Array<{
    id: string;
    type: 'send' | 'swap' | 'contract';
    to: string;
    amount: string;
    status: string;
    confirmations?: string;
  }>;
}
```

### Navigation from Panel to Main Window

Panel renderer sends:
```typescript
ipcRenderer.send('tray-action', { type: 'open-page', route: '/...' });
```

Main process receives, calls `showMainWindow()`, then forwards route to main window renderer.

## System Notifications

- On each poll cycle, `TrayManager` diffs `pendingTxs` against the previous state.
- When a transaction transitions from pending → confirmed or pending → failed:
  - Push a macOS native `Notification` via Electron's `Notification` API.
  - Title: "Transaction Confirmed" / "Transaction Failed"
  - Body: amount + truncated target address
  - Click notification → `showMainWindow()` + navigate to transaction detail.
- Notifications are suppressed when the app is locked.

## Edge Cases & Boundary Conditions

### App Locked

- Panel shows a locked state: OneKey logo + "App is locked" message.
- No asset/ticker/transaction data is displayed.
- Click → open main window unlock page.
- Polling and notifications are paused.

### Main Window Not Ready

- During cold start, the main window renderer may not be loaded yet.
- Tray icon is created immediately, but the panel shows a loading state.
- Normal polling begins after the main window sends the `APP_READY` IPC signal.

### No Wallet

- Panel shows "Create or import a wallet in the app" message.
- No polling, no notifications.

### Network Offline

- Panel displays the last cached data + "Network unavailable" indicator.
- Polling continues to retry. Data refreshes automatically when connectivity returns.

## What This Design Does NOT Include

- Windows/Linux support
- In-panel actions (send, approve, swap)
- Multiple wallet aggregation
- Tray icon badge or text overlay
- Quick copy address functionality
- Account switching from the panel
- Customizable panel layout or sections
