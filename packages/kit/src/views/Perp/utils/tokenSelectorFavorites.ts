type ITokenSelectorFavoriteItem = {
  mode: 'perp' | 'spot';
  coinName: string;
  dexIndex: number;
  assetId: number;
};

type ITokenSelectorFavoriteOrderEntry = {
  mode: 'perp' | 'spot';
  coinName: string;
};

type ITokenSelectorListItemLike = {
  dexIndex: number;
  assetId?: number;
};

function getTokenSelectorFavoriteKey(item: ITokenSelectorListItemLike): string {
  return `${item.dexIndex}-${item.assetId ?? ''}`;
}

function getTokenSelectorFavoriteItems<T extends ITokenSelectorListItemLike>({
  favoriteItems,
  favoritesOrder,
  perpItems,
  spotItems,
}: {
  favoriteItems: ITokenSelectorFavoriteItem[];
  favoritesOrder: ITokenSelectorFavoriteOrderEntry[];
  perpItems: T[];
  spotItems: T[];
}): T[] {
  const perpItemsByKey = new Map(
    perpItems.map((item) => [getTokenSelectorFavoriteKey(item), item]),
  );
  const spotItemsByKey = new Map(
    spotItems.map((item) => [getTokenSelectorFavoriteKey(item), item]),
  );
  const favoriteRowsByOrderKey = new Map<string, T>();

  for (const favorite of favoriteItems) {
    const itemKey = getTokenSelectorFavoriteKey(favorite);
    const row =
      favorite.mode === 'spot'
        ? spotItemsByKey.get(itemKey)
        : perpItemsByKey.get(itemKey);
    if (row) {
      favoriteRowsByOrderKey.set(`${favorite.mode}:${favorite.coinName}`, row);
    }
  }

  const ordered: T[] = [];
  const seenOrderKeys = new Set<string>();
  for (const entry of favoritesOrder) {
    const orderKey = `${entry.mode}:${entry.coinName}`;
    const row = favoriteRowsByOrderKey.get(orderKey);
    if (row) {
      ordered.push(row);
      seenOrderKeys.add(orderKey);
    }
  }

  for (const favorite of favoriteItems) {
    const orderKey = `${favorite.mode}:${favorite.coinName}`;
    if (!seenOrderKeys.has(orderKey)) {
      const row = favoriteRowsByOrderKey.get(orderKey);
      if (row) {
        ordered.push(row);
        seenOrderKeys.add(orderKey);
      }
    }
  }

  return ordered;
}

export { getTokenSelectorFavoriteItems };
