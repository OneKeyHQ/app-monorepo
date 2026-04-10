export type IRecommendedRefreshAccount = {
  accountId: string;
  networkId: string;
};

export type IRecommendedWatchTarget = {
  networkId: string;
  provider: string;
  symbol: string;
};

export type IRefreshEventPayload = {
  accounts?: IRecommendedRefreshAccount[];
};

export type IRefreshSource = 'app-event' | 'pending-tx';

export type IShouldRefreshByAccounts = (
  accounts: IRecommendedRefreshAccount[],
) => boolean;

export type IScheduleRecommendedRefresh = (params?: {
  source?: IRefreshSource;
  delayMs?: number;
}) => void;
