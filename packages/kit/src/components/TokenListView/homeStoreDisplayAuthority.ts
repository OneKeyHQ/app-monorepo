import type { IAccountToken } from '@onekeyhq/shared/types/token';

type IResolveHomeTokenProjectionBaseParams = {
  homeStoreDisplayIds: readonly string[] | undefined;
  localOrderedIds: readonly string[];
  localSmallBalanceIds: readonly string[];
};

export function resolveHomeTokenProjectionBase({
  homeStoreDisplayIds,
  localOrderedIds,
  localSmallBalanceIds,
}: IResolveHomeTokenProjectionBaseParams): {
  orderedIds: string[];
  smallBalanceIds: string[];
} {
  if (homeStoreDisplayIds !== undefined) {
    const localSmallBalanceIdSet = new Set(localSmallBalanceIds);
    return {
      orderedIds: homeStoreDisplayIds.filter(
        (id) => !localSmallBalanceIdSet.has(id),
      ),
      smallBalanceIds: homeStoreDisplayIds.filter((id) =>
        localSmallBalanceIdSet.has(id),
      ),
    };
  }
  return {
    orderedIds: [...localOrderedIds],
    smallBalanceIds: [...localSmallBalanceIds],
  };
}

export function selectHomeTokensByStoreIds({
  homeStoreDisplayIds,
  tokens,
}: {
  homeStoreDisplayIds: readonly string[] | undefined;
  tokens: IAccountToken[];
}): IAccountToken[] {
  if (homeStoreDisplayIds === undefined) {
    return tokens;
  }
  const tokenMap = new Map(tokens.map((token) => [token.$key, token]));
  return homeStoreDisplayIds
    .map((id) => tokenMap.get(id))
    .filter((token): token is IAccountToken => token !== undefined);
}
