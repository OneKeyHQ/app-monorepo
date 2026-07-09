import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

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

type ITokenRefreshPlanAfterHistory = {
  accountsToRefreshNow: IChangedAccount[];
  accountsToRefreshAfterTokensDone: IChangedAccount[];
  tokensDoneScope?: IChangedAccount;
};

const getTokensDoneScope = ({
  accountId,
  networkId,
}: IChangedAccount): IChangedAccount => ({
  accountId,
  networkId,
});

export function buildTokenRefreshPlanAfterHistory({
  accounts,
  lastTokensTabState,
  tokenRefreshScope,
}: {
  accounts: IChangedAccount[];
  lastTokensTabState: ITokensTabLastState | undefined;
  tokenRefreshScope?: ITokenRefreshScope;
}): ITokenRefreshPlanAfterHistory {
  const refreshNow: ITokenRefreshPlanAfterHistory = {
    accountsToRefreshNow: accounts,
    accountsToRefreshAfterTokensDone: [],
  };

  if (!lastTokensTabState?.isRefreshing) {
    return refreshNow;
  }

  const matchedAccount =
    !tokenRefreshScope ||
    lastTokensTabState.accountId === tokenRefreshScope.accountId;
  if (
    matchedAccount &&
    networkUtils.isAllNetwork({ networkId: lastTokensTabState.networkId })
  ) {
    return {
      accountsToRefreshNow: [],
      accountsToRefreshAfterTokensDone: accounts,
      tokensDoneScope: getTokensDoneScope(lastTokensTabState),
    };
  }

  const matchedScope =
    tokenRefreshScope &&
    lastTokensTabState.accountId === tokenRefreshScope.accountId &&
    lastTokensTabState.networkId === tokenRefreshScope.networkId;

  if (tokenRefreshScope && !matchedScope) {
    return refreshNow;
  }

  const coveredAccount = matchedScope ? tokenRefreshScope : lastTokensTabState;
  if (matchedScope && tokenRefreshScope.includesAllAccountsInNetwork) {
    const accountsToRefreshAfterTokensDone = accounts.filter(
      (account) => account.networkId === tokenRefreshScope.networkId,
    );
    const accountsToRefreshNow = accounts.filter(
      (account) => account.networkId !== tokenRefreshScope.networkId,
    );
    return {
      accountsToRefreshNow,
      accountsToRefreshAfterTokensDone,
      tokensDoneScope: getTokensDoneScope(lastTokensTabState),
    };
  }

  const accountsToRefreshAfterTokensDone = accounts.filter(
    (account) =>
      account.accountId === coveredAccount.accountId &&
      account.networkId === coveredAccount.networkId,
  );
  const accountsToRefreshNow = accounts.filter(
    (account) =>
      account.accountId !== coveredAccount.accountId ||
      account.networkId !== coveredAccount.networkId,
  );

  return {
    accountsToRefreshNow,
    accountsToRefreshAfterTokensDone,
    tokensDoneScope: getTokensDoneScope(lastTokensTabState),
  };
}
