function sanitizeDevSettingsSearchHistory(items: unknown[]): string[] {
  const seen = new Set<string>();
  const history: string[] = [];

  for (const item of items) {
    if (typeof item === 'string') {
      const searchText = item.trim();
      const normalizedSearchText = searchText.toLowerCase();
      if (searchText && !seen.has(normalizedSearchText)) {
        history.push(searchText);
        seen.add(normalizedSearchText);
      }
    }
  }

  return history;
}

export function addDevSettingsSearchHistoryItem(
  history: readonly string[],
  searchText: string,
): string[] {
  return sanitizeDevSettingsSearchHistory([searchText, ...history]);
}

export function removeDevSettingsSearchHistoryItem(
  history: readonly string[],
  searchText: string,
): string[] {
  const normalizedSearchText = searchText.trim().toLowerCase();
  return history.filter(
    (item) => item.trim().toLowerCase() !== normalizedSearchText,
  );
}

export function parseDevSettingsSearchHistory(
  raw: string | undefined,
): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? sanitizeDevSettingsSearchHistory(parsed)
      : [];
  } catch {
    return [];
  }
}
