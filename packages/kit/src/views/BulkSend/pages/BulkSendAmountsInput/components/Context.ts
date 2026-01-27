import { createContext, useContext } from 'react';

import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';
import {
  EAmountInputMode,
  EBulkSendMode,
  type IAmountInputError,
  type IAmountInputValues,
  type ITransferInfoErrors,
} from '@onekeyhq/shared/types/bulkSend';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';

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
  transferInfoErrors: ITransferInfoErrors;
  setTransferInfoErrors: (errors: ITransferInfoErrors) => void;
  isAmountValid: boolean;
  // Total amounts
  totalTokenAmount: string;
  totalFiatAmount: string;
  isInsufficientBalance: boolean;
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
    transferInfoErrors: {},
    setTransferInfoErrors: () => {},
    isAmountValid: false,
    totalTokenAmount: '0',
    totalFiatAmount: '0',
    isInsufficientBalance: false,
  });

export const useBulkSendAmountsInputContext = () =>
  useContext(BulkSendAmountsInputContext);
