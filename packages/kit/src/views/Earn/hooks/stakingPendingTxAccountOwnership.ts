export type IStakingPendingTxAccountOwnership = {
  accountId?: string;
  indexedAccountId?: string;
  currentNetworkId?: string;
  hasExplicitOwnership: boolean;
};

export const resolveStakingPendingTxAccountOwnership = ({
  activeAccountId,
  activeIndexedAccountId,
  activeNetworkId,
  accountId,
  indexedAccountId,
  networkIds,
}: {
  activeAccountId?: string;
  activeIndexedAccountId?: string;
  activeNetworkId?: string;
  accountId?: string;
  indexedAccountId?: string;
  networkIds: string[];
}): IStakingPendingTxAccountOwnership => {
  const hasExplicitOwnership = Boolean(accountId || indexedAccountId);
  if (!hasExplicitOwnership) {
    return {
      accountId: activeAccountId,
      indexedAccountId: activeIndexedAccountId,
      currentNetworkId: activeNetworkId,
      hasExplicitOwnership: false,
    };
  }

  const uniqueNetworkIds = [...new Set(networkIds.filter(Boolean))];
  return {
    accountId,
    indexedAccountId,
    currentNetworkId:
      accountId && uniqueNetworkIds.length === 1
        ? uniqueNetworkIds[0]
        : undefined,
    hasExplicitOwnership: true,
  };
};
