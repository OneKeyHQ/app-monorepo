/**
 * Default no-op variant. Native/web platforms have no Electron <webview>
 * popup IPC, so the overlay's `window.open` policing is handled inline by
 * react-native-webview's `onOpenWindow` callback on those platforms.
 *
 * Desktop-specific implementation lives in `useOverlayDesktopPopup.desktop.ts`.
 */

export interface IUseOverlayDesktopPopupArgs {
  webContentsId: number | null;
}

export function useOverlayDesktopPopup(
  _args: IUseOverlayDesktopPopupArgs,
): void {
  // intentionally empty on non-desktop platforms
}
