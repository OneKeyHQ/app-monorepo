import { useMemo } from 'react';

export type IBorrowAction = 'supply' | 'withdraw' | 'borrow' | 'repay';

export type IBorrowApiParams = {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  accountId: string;
  action: IBorrowAction;
};

type IUseBorrowApiParamsArgs = {
  useBorrowApi?: boolean;
  networkId?: string;
  provider?: string;
  marketAddress?: string;
  reserveAddress?: string;
  accountId?: string;
  action?: IBorrowAction;
};

export type IBorrowApiContext =
  | {
      isBorrow: true;
      isEarn: false;
      borrowApiParams: IBorrowApiParams;
    }
  | {
      isBorrow: false;
      isEarn: true;
      borrowApiParams?: undefined;
    };

export function useBorrowApiParams({
  useBorrowApi,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  accountId,
  action,
}: IUseBorrowApiParamsArgs): IBorrowApiContext {
  const borrowApiParams = useMemo<IBorrowApiParams | undefined>(() => {
    if (!useBorrowApi) {
      return undefined;
    }

    if (
      !networkId ||
      !provider ||
      !marketAddress ||
      !reserveAddress ||
      !accountId ||
      !action
    ) {
      return undefined;
    }

    return {
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      accountId,
      action,
    };
  }, [
    useBorrowApi,
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    accountId,
    action,
  ]);

  return useMemo(() => {
    if (!borrowApiParams) {
      return {
        isBorrow: false,
        isEarn: true,
        borrowApiParams: undefined,
      };
    }
    return {
      isBorrow: true,
      isEarn: false,
      borrowApiParams,
    };
  }, [borrowApiParams]);
}
