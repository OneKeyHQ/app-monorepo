/**
 * IPC channel names shared between the desktop main process and the renderer.
 *
 * The main-process source of truth lives in `apps/desktop/app/config.ts`
 * (`ipcMessageKeys`). This file re-exports the subset of channel names that
 * non-desktop packages (e.g. `@onekeyhq/kit`) need to subscribe to without
 * importing from the `apps/desktop/*` tree, which would invert the
 * `shared → components → kit-bg → kit → apps` hierarchy.
 *
 * Keep these values in sync with the corresponding entries in
 * `ipcMessageKeys`.
 */

export const EDesktopIpcChannel = {
  WEBVIEW_NEW_WINDOW: 'webview/newWindow',
} as const;

export type EDesktopIpcChannel =
  (typeof EDesktopIpcChannel)[keyof typeof EDesktopIpcChannel];
