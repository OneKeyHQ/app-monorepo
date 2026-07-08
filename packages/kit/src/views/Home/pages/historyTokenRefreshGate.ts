type IChangedAccount = {
  accountId: string;
  networkId: string;
};

type ITokensTabLastState = IChangedAccount & {
  at: number;
  isRefreshing: boolean;
};

type ITokenRefreshScope = IChangedAccount & {
  includesAllAccountsInNetwork?: boolean;
};

export function filterAccountsNeedingTokenRefreshAfterHistory({
  accounts,
  lastTokensTabState,
  tokenRefreshScope,
  now,
  minIntervalMs,
}: {
  accounts: IChangedAccount[];
  lastTokensTabState: ITokensTabLastState | undefined;
  tokenRefreshScope?: ITokenRefreshScope;
  now: number;
  minIntervalMs: number;
}) {
  if (!lastTokensTabState) {
    return accounts;
  }

  if (now - lastTokensTabState.at >= minIntervalMs) {
    return accounts;
  }

  const matchedScope =
    tokenRefreshScope &&
    lastTokensTabState.accountId === tokenRefreshScope.accountId &&
    lastTokensTabState.networkId === tokenRefreshScope.networkId;

  if (matchedScope && tokenRefreshScope.includesAllAccountsInNetwork) {
    return accounts.filter(
      (account) => account.networkId !== tokenRefreshScope.networkId,
    );
  }

  const coveredAccount = matchedScope ? tokenRefreshScope : lastTokensTabState;

  return accounts.filter(
    (account) =>
      account.accountId !== coveredAccount.accountId ||
      account.networkId !== coveredAccount.networkId,
  );
}
