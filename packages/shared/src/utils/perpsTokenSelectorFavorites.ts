export type ITokenSelectorFavoriteMode = 'perp' | 'spot';
export type ITokenSelectorFavoriteAction = 'add' | 'remove' | 'toggle';
export type IResolvedTokenSelectorFavoriteAction = 'add' | 'remove' | 'none';

export type ITokenSelectorFavoriteOrderEntry = {
  mode: ITokenSelectorFavoriteMode;
  coinName: string;
};

function getTokenSelectorFavoriteOrderKey(
  entry: ITokenSelectorFavoriteOrderEntry,
): string {
  return `${entry.mode}:${entry.coinName}`;
}

function dedupeTokenSelectorFavoriteCoins(favorites: string[]) {
  return [...new Set(favorites)];
}

function dedupeTokenSelectorFavoritesOrder(
  sequence: ITokenSelectorFavoriteOrderEntry[],
) {
  const seen = new Set<string>();
  return sequence.filter((entry) => {
    const key = getTokenSelectorFavoriteOrderKey(entry);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function updateTokenSelectorFavoriteCoins({
  favorites,
  coin,
  action,
}: {
  favorites: string[];
  coin: string;
  action: ITokenSelectorFavoriteAction;
}): {
  favorites: string[];
  action: IResolvedTokenSelectorFavoriteAction;
} {
  const uniqueFavorites = dedupeTokenSelectorFavoriteCoins(favorites);
  const hasCoin = uniqueFavorites.includes(coin);
  if (action === 'remove' || (action === 'toggle' && hasCoin)) {
    return {
      favorites: uniqueFavorites.filter((favorite) => favorite !== coin),
      action: hasCoin ? 'remove' : 'none',
    };
  }
  if (action === 'add' || (action === 'toggle' && !hasCoin)) {
    return {
      favorites: hasCoin ? uniqueFavorites : [...uniqueFavorites, coin],
      action: hasCoin ? 'none' : 'add',
    };
  }
  return {
    favorites: uniqueFavorites,
    action: 'none',
  };
}

function toggleTokenSelectorFavoriteCoin({
  favorites,
  coin,
}: {
  favorites: string[];
  coin: string;
}): {
  favorites: string[];
  action: 'add' | 'remove';
} {
  const result = updateTokenSelectorFavoriteCoins({
    favorites,
    coin,
    action: 'toggle',
  });
  return {
    favorites: result.favorites,
    action: result.action === 'remove' ? 'remove' : 'add',
  };
}

function isSameStringArray(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function isSameFavoritesOrderSequence(
  a: ITokenSelectorFavoriteOrderEntry[],
  b: ITokenSelectorFavoriteOrderEntry[],
) {
  return (
    a.length === b.length &&
    a.every(
      (item, index) =>
        item.mode === b[index]?.mode && item.coinName === b[index]?.coinName,
    )
  );
}

function reconcileTokenSelectorFavoritesOrder({
  sequence,
  perpFavorites,
  spotFavorites,
}: {
  sequence: ITokenSelectorFavoriteOrderEntry[];
  perpFavorites: string[];
  spotFavorites: string[];
}) {
  const entries: ITokenSelectorFavoriteOrderEntry[] = [
    ...perpFavorites.map((coinName) => ({
      mode: 'perp' as const,
      coinName,
    })),
    ...spotFavorites.map((coinName) => ({
      mode: 'spot' as const,
      coinName,
    })),
  ];
  const validKeys = new Set(
    entries.map((entry) => getTokenSelectorFavoriteOrderKey(entry)),
  );
  const filtered = dedupeTokenSelectorFavoritesOrder(sequence).filter((entry) =>
    validKeys.has(getTokenSelectorFavoriteOrderKey(entry)),
  );
  const orderedKeys = new Set(
    filtered.map((entry) => getTokenSelectorFavoriteOrderKey(entry)),
  );
  const missing = entries.filter(
    (entry) => !orderedKeys.has(getTokenSelectorFavoriteOrderKey(entry)),
  );
  return [...filtered, ...missing];
}

export {
  dedupeTokenSelectorFavoriteCoins,
  dedupeTokenSelectorFavoritesOrder,
  getTokenSelectorFavoriteOrderKey,
  isSameFavoritesOrderSequence,
  isSameStringArray,
  reconcileTokenSelectorFavoritesOrder,
  toggleTokenSelectorFavoriteCoin,
  updateTokenSelectorFavoriteCoins,
};
