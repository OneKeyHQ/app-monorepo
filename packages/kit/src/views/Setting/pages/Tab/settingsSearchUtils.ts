export const SETTINGS_SEARCH_KEYS = [
  'title',
  'mobileTitle',
  'keywords',
] as const;

export function getSettingsSearchSectionItem<
  T extends { mobilePlacement?: unknown },
>(item: T): T | undefined {
  return item.mobilePlacement === 'home' ? undefined : item;
}
