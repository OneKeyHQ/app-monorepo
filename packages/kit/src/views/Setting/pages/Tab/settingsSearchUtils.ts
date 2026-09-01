export const SETTINGS_SEARCH_KEYS = [
  { name: 'title', weight: 3 },
  { name: 'mobileTitle', weight: 3 },
  { name: 'keywords', weight: 1 },
] as const;

export function normalizeSettingsSearchQuery(query: string): string {
  return query.trim();
}
