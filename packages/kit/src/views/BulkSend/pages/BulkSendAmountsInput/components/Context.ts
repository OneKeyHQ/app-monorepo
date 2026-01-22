import { createContext, useContext } from 'react';

import BigNumber from 'bignumber.js';

import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';
import {
  EAmountInputMode,
  EBulkSendMode,
} from '@onekeyhq/shared/types/bulkSend';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';

export type IAmountInputValues = {
  specifiedAmount: string;
  rangeMin: string;
  rangeMax: string;
};

export type IAmountInputError = {
  specifiedAmount?: string;
  rangeMin?: string;
  rangeMax?: string;
};

export type IBulkSendAmountsInputContext = {
  accountId: string | undefined;
  networkId: string;
  tokenInfo: IToken;
  tokenDetails: ({ info: IToken } & ITokenFiat) | undefined;
  setTokenDetails: (
    tokenDetails: ({ info: IToken } & ITokenFiat) | undefined,
  ) => void;
  tokenDetailsState: {
    initialized: boolean;
    isRefreshing: boolean;
  };
  setTokenDetailsState: (state: {
    initialized: boolean;
    isRefreshing: boolean;
  }) => void;
  bulkSendMode: EBulkSendMode;
  transfersInfo: ITransferInfo[];
  setTransfersInfo: (transfersInfo: ITransferInfo[]) => void;
  amountInputMode: EAmountInputMode;
  setAmountInputMode: (amountInputMode: EAmountInputMode) => void;
  // Amount input values
  amountInputValues: IAmountInputValues;
  setAmountInputValues: (values: IAmountInputValues) => void;
  // Validation
  amountInputErrors: IAmountInputError;
  setAmountInputErrors: (errors: IAmountInputError) => void;
  isAmountValid: boolean;
  // Total amounts
  totalTokenAmount: string;
  totalFiatAmount: string;
};

export const BulkSendAmountsInputContext =
  createContext<IBulkSendAmountsInputContext>({
    accountId: undefined,
    networkId: '',
    transfersInfo: [],
    setTransfersInfo: () => {},
    tokenDetails: undefined,
    tokenInfo: {
      address: '',
      name: '',
      symbol: '',
      decimals: 18,
      isNative: false,
    },
    setTokenDetails: () => {},
    tokenDetailsState: {
      initialized: false,
      isRefreshing: false,
    },
    setTokenDetailsState: () => {},
    bulkSendMode: EBulkSendMode.OneToMany,
    amountInputMode: EAmountInputMode.Specified,
    setAmountInputMode: () => {},
    amountInputValues: {
      specifiedAmount: '',
      rangeMin: '',
      rangeMax: '',
    },
    setAmountInputValues: () => {},
    amountInputErrors: {},
    setAmountInputErrors: () => {},
    isAmountValid: false,
    totalTokenAmount: '0',
    totalFiatAmount: '0',
  });

export const useBulkSendAmountsInputContext = () =>
  useContext(BulkSendAmountsInputContext);

export function calculateIsAmountValid({
  amountInputMode,
  amountInputErrors,
  amountInputValues,
  transfersInfo,
  balanceParsed,
}: {
  amountInputMode: EAmountInputMode;
  amountInputErrors: IAmountInputError;
  amountInputValues: IAmountInputValues;
  transfersInfo: ITransferInfo[];
  balanceParsed: string;
}): boolean {
  switch (amountInputMode) {
    case EAmountInputMode.Specified:
      return (
        !amountInputErrors.specifiedAmount &&
        amountInputValues.specifiedAmount !== ''
      );
    case EAmountInputMode.Range:
      return (
        !amountInputErrors.rangeMin &&
        !amountInputErrors.rangeMax &&
        amountInputValues.rangeMin !== '' &&
        amountInputValues.rangeMax !== ''
      );
    case EAmountInputMode.Custom: {
      const totalAmount = transfersInfo.reduce((sum, t) => {
        const amount = new BigNumber(t.amount || '0');
        return sum.plus(amount.isNaN() ? 0 : amount);
      }, new BigNumber(0));
      const balance = new BigNumber(balanceParsed);
      return (
        totalAmount.isGreaterThan(0) && totalAmount.isLessThanOrEqualTo(balance)
      );
    }
    default:
      return false;
  }
}

export function calculateTotalAmounts({
  amountInputMode,
  amountInputValues,
  transfersInfo,
  tokenPrice,
}: {
  amountInputMode: EAmountInputMode;
  amountInputValues: IAmountInputValues;
  transfersInfo: ITransferInfo[];
  tokenPrice: number | undefined;
}): { totalTokenAmount: string; totalFiatAmount: string } {
  switch (amountInputMode) {
    case EAmountInputMode.Specified: {
      const amount = new BigNumber(amountInputValues.specifiedAmount || '0');
      if (amount.isNaN() || amount.isZero()) {
        return { totalTokenAmount: '0', totalFiatAmount: '0' };
      }
      const total = amount.times(transfersInfo.length);
      const fiat =
        tokenPrice && !total.isZero() ? total.times(tokenPrice).toFixed() : '0';
      return {
        totalTokenAmount: total.toFixed(),
        totalFiatAmount: fiat,
      };
    }
    case EAmountInputMode.Range:
      // Cannot calculate exact total for range mode
      return { totalTokenAmount: '0', totalFiatAmount: '0' };
    case EAmountInputMode.Custom: {
      let total = new BigNumber(0);
      for (const transfer of transfersInfo) {
        const amount = new BigNumber(transfer.amount || '0');
        if (!amount.isNaN()) {
          total = total.plus(amount);
        }
      }
      const fiat =
        tokenPrice && !total.isZero() ? total.times(tokenPrice).toFixed() : '0';
      return {
        totalTokenAmount: total.isZero() ? '0' : total.toFixed(),
        totalFiatAmount: fiat,
      };
    }
    default:
      return { totalTokenAmount: '0', totalFiatAmount: '0' };
  }
}
