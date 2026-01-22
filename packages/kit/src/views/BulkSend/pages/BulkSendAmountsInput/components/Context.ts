import { createContext, useContext } from 'react';

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
  });

export const useBulkSendAmountsInputContext = () =>
  useContext(BulkSendAmountsInputContext);
