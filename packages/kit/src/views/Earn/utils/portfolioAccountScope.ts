import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IEarnAccountTokenResponse } from '@onekeyhq/shared/types/staking';

export function earnPortfolioAccountScope({
  account,
  indexedAccountId,
}: {
  account?: INetworkAccount;
  indexedAccountId?: string;
}): string {
  return stableStringify([
    account?.id ?? '',
    indexedAccountId ?? '',
    account?.addressDetail?.address ?? '',
    account?.address ?? '',
    account && 'connectedAddresses' in account
      ? [account.connectedAddresses, account.selectedAddress]
      : undefined,
  ]);
}

export function earnPortfolioDataScope({
  earnAccountKey,
  account,
  indexedAccountId,
}: {
  earnAccountKey: string;
  account?: INetworkAccount;
  indexedAccountId?: string;
}): string {
  return JSON.stringify([
    earnAccountKey,
    earnPortfolioAccountScope({ account, indexedAccountId }),
  ]);
}

export function getScopedPortfolioEarnAccount(
  account: IEarnAccountTokenResponse | undefined,
  scope: string,
): IEarnAccountTokenResponse | undefined {
  return account?.portfolioAccountScope === scope ? account : undefined;
}
