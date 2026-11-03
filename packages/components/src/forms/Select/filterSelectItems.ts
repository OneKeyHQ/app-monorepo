// localeSearch.ts also imports the translations enum. Select is on the web
// startup graph, so the text helper has to come from the module that does not.
import { normalizeSearchText } from '@onekeyhq/shared/src/locale/normalizeSearchText';

import type { ISelectItem } from './type';

export function filterSelectItems(
  items: ISelectItem[] | undefined,
  query: string,
): ISelectItem[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!items?.length || !normalizedQuery) {
    return items ?? [];
  }
  const exactMatches: ISelectItem[] = [];
  const partialMatches: ISelectItem[] = [];
  for (const item of items) {
    const fields = [
      item.label,
      item.description,
      ...(item.searchKeywords ?? []),
    ].map((field) => (field ? normalizeSearchText(field) : ''));
    if (fields.includes(normalizedQuery)) {
      exactMatches.push(item);
    } else if (fields.some((field) => field.includes(normalizedQuery))) {
      partialMatches.push(item);
    }
  }
  return [...exactMatches, ...partialMatches];
}
