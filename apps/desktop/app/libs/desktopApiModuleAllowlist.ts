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
    selected.hash = '';
    frame.hash = '';
    if (selected.href === frame.href) return true;
    if (!sameDocumentRouteUrl) return false;
    const route = new URL(sameDocumentRouteUrl);
    route.hash = '';
    // Only a route observed in the trusted document can survive a dev reload.
    if (
      isDevServer &&
      (selected.protocol === 'http:' || selected.protocol === 'https:')
    ) {
      if (
        !['localhost', '127.0.0.1', '[::1]'].includes(selected.hostname) ||
        selected.origin !== frame.origin ||
        selected.searchParams.get('render') !==
          frame.searchParams.get('render') ||
        /\.html?$/i.test(decodeURIComponent(frame.pathname))
      ) {
        return false;
      }
    }
    return route.href === frame.href;
  } catch {
    return false;
  }
}
