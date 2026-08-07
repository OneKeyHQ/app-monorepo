export { isTrustedDesktopApiRendererUrl } from './trustedDesktopApiRenderer';

export function assertDesktopApiMethodAccess(): void {
  // Development-only APIs are absent from the production webview module.
}
