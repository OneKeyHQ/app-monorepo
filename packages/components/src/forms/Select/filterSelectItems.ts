import { matchesSearchQuery } from '@onekeyhq/shared/src/locale/localeSearch';

import type { ISelectItem } from './type';

export function filterSelectItems(
  items: ISelectItem[] | undefined,
  query: string,
): ISelectItem[] {
  if (!items?.length || !query.trim()) {
    return items ?? [];
  }
  return items.filter((item) =>
    matchesSearchQuery(
      [item.label, item.description, ...(item.searchKeywords ?? [])],
      query,
    ),
  );
}
