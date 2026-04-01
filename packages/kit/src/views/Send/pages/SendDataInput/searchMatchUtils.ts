export function normalizeSearchKey(searchKey?: string) {
  return searchKey?.trim().toLowerCase() ?? '';
}

export function prioritizeNameThenAddressMatches<T>({
  items,
  isNameMatch,
  isAddressMatch,
}: {
  items: T[];
  isNameMatch: (item: T) => boolean;
  isAddressMatch: (item: T) => boolean;
}) {
  const nameMatched: T[] = [];
  const addressOnlyMatched: T[] = [];

  for (const item of items) {
    if (isNameMatch(item)) {
      nameMatched.push(item);
    } else if (isAddressMatch(item)) {
      addressOnlyMatched.push(item);
    }
  }

  return {
    nameMatched,
    addressOnlyMatched,
    sorted: [...nameMatched, ...addressOnlyMatched],
  };
}
