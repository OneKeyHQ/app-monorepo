export const DEFAULT_PERPS_SUBTITLE_MAX_CHARS = 10;

export function truncatePerpsSubtitle(
  subtitle: string,
  maxChars = DEFAULT_PERPS_SUBTITLE_MAX_CHARS,
) {
  if (!subtitle) {
    return '';
  }

  if (subtitle.length <= maxChars) {
    return subtitle;
  }

  return `${subtitle.slice(0, maxChars)}...`;
}
