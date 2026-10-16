export {
  DESKTOP_API_ALLOWED_MODULES,
  isDesktopApiMethodAllowed,
  isDesktopApiModuleAllowed,
} from '@onekeyhq/kit-bg/src/desktopApis/desktopApiMethodPolicy';

export function isTrustedMainWindowUrl(
  selectedAppShellUrl: string,
  frameUrl: string,
): boolean {
  try {
    const selected = new URL(selectedAppShellUrl);
    const frame = new URL(frameUrl);
    selected.hash = '';
    frame.hash = '';
    return selected.href === frame.href;
  } catch {
    return false;
  }
}
