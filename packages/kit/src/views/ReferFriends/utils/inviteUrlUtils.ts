/**
 * Format invite URL for display by removing protocol
 * @param url - Full URL like "https://onekey.so/invite/ABC123"
 * @returns Formatted URL like "onekey.so/invite/ABC123"
 */
export function formatInviteUrlForDisplay(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

/**
 * Generate invite URL from template by replacing the code
 * @param template - URL template like "https://onekey.so/invite/OLD_CODE"
 * @param code - New invite code
 * @returns Generated URL like "https://onekey.so/invite/NEW_CODE"
 */
export function generateInviteUrlFromTemplate(
  template: string,
  code: string,
): string {
  const lastSlashIndex = template.lastIndexOf('/');
  return template.substring(0, lastSlashIndex + 1) + code;
}
