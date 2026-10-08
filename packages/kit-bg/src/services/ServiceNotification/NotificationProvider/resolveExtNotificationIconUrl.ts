export const EXT_NOTIFICATION_DEFAULT_ICON_PATH = 'icon-128.png';

export function resolveExtNotificationIconUrl(icon?: string): string {
  if (icon) {
    return icon;
  }
  // Packaged extension icon is a reliable OS-notification source identity.
  // Remote HTTPS icons can fail chrome.notifications.create, and a 1x1
  // transparent fallback makes macOS show the Chrome icon instead.
  return chrome.runtime.getURL(EXT_NOTIFICATION_DEFAULT_ICON_PATH);
}
