/**
 * IPC channel names shared between the desktop main process and the renderer.
 *
 * Desktop app configuration reuses these names so other packages can send or
 * subscribe to these channels without importing from the application layer.
 */

export const EDesktopIpcChannel = {
  CLIENT_LOG_UPLOAD_PROGRESS: 'client-log/upload-progress',
  WEBVIEW_NEW_WINDOW: 'webview/newWindow',
  PRIME_STRIPE_RESOURCE_FORBIDDEN: 'prime/stripeResourceForbidden',
} as const;

export type EDesktopIpcChannel =
  (typeof EDesktopIpcChannel)[keyof typeof EDesktopIpcChannel];
