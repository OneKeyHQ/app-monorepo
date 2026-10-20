export {
  DESKTOP_API_ALLOWED_MODULES,
  isDesktopApiMethodAllowed,
  isDesktopApiModuleAllowed,
} from '@onekeyhq/kit-bg/src/desktopApis/desktopApiMethodPolicy';

export function isTrustedMainWindowUrl(
  selectedAppShellUrl: string,
  frameUrl: string,
  sameDocumentRouteUrl?: string,
  isDevServer = false,
): boolean {
  try {
    const selected = new URL(selectedAppShellUrl);
    const frame = new URL(frameUrl);
    // The local dev server serves the app shell at SPA route paths on reload.
    if (
      isDevServer &&
      (selected.protocol === 'http:' || selected.protocol === 'https:') &&
      ['localhost', '127.0.0.1', '[::1]'].includes(selected.hostname) &&
      selected.origin === frame.origin
    ) {
      return true;
    }
    selected.hash = '';
    frame.hash = '';
    if (selected.href === frame.href) return true;
    if (!sameDocumentRouteUrl) return false;
    const route = new URL(sameDocumentRouteUrl);
    route.hash = '';
    return route.href === frame.href;
  } catch {
    return false;
  }
}
