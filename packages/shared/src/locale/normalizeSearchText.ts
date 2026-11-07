export function normalizeSearchText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replaceAll('_', '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function matchesSearchQuery(
  fields: Array<string | undefined>,
  query: string,
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }
  return fields.some((field) => {
    if (!field) {
      return false;
    }
    return normalizeSearchText(field).includes(normalizedQuery);
  });
}
