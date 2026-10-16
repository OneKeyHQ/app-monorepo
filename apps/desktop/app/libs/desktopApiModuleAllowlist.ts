export {
  DESKTOP_API_ALLOWED_MODULES,
  isDesktopApiMethodAllowed,
  isDesktopApiModuleAllowed,
} from '@onekeyhq/kit-bg/src/desktopApis/desktopApiMethodPolicy';

export function isTrustedMainWindowUrl(
  selectedAppShellUrl: string,
  frameUrl: string,
  sameDocumentRouteUrl?: string,
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
    return route.href === frame.href;
  } catch {
    return false;
  }
}
