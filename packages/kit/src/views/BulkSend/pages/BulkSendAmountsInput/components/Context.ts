import { createContext, useContext } from 'react';

import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAmountInputMode,
  EBulkSendMode,
  type IAmountInputError,
  type IAmountInputValues,
  type ITransferInfoErrors,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

export type IPreviewState = {
  specifiedPreviewed: boolean;
  rangePreviewed: boolean;
  // Pre-generated amounts for Range mode preview
  rangePreviewAmounts: string[];
};

// Mobile-specific data structure for each mode
export type IMobileModeData = {
  transfersInfo: ITransferInfo[];
  transferInfoErrors: ITransferInfoErrors;
  isInsufficientBalance: boolean;
  totalTokenAmount: string;
  totalFiatAmount: string;
};

export type IMobileModeDataByMode = Record<EAmountInputMode, IMobileModeData>;

export type IBulkSendAmountsInputContext = {
  accountId: string | undefined;
  networkId: string;
  tokenInfo: IToken;
  // Whether receivers have custom amounts (from address input)
  hasCustomAmounts: boolean;
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
  // Desktop uses these directly
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
  // Preview state for Specified/Range modes
  previewState: IPreviewState;
  setPreviewState: React.Dispatch<React.SetStateAction<IPreviewState>>;
  // Mobile-specific: data by mode
  mobileModeData: IMobileModeDataByMode;
  setMobileModeData: (data: IMobileModeDataByMode) => void;
  // Helper to update current mode's data
  updateCurrentModeData: (data: Partial<IMobileModeData>) => void;
  // Get current mode's data for mobile
  currentModeData: IMobileModeData;
};

const defaultModeData: IMobileModeData = {
  transfersInfo: [],
  transferInfoErrors: {},
  isInsufficientBalance: false,
  totalTokenAmount: '0',
  totalFiatAmount: '0',
};

export const BulkSendAmountsInputContext =
  createContext<IBulkSendAmountsInputContext>({
    accountId: undefined,
    networkId: '',
    hasCustomAmounts: false,
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
    previewState: {
      specifiedPreviewed: false,
      rangePreviewed: false,
      rangePreviewAmounts: [],
    },
    setPreviewState: () => {},
    // Mobile-specific
    mobileModeData: {
      [EAmountInputMode.Specified]: { ...defaultModeData },
      [EAmountInputMode.Range]: { ...defaultModeData },
      [EAmountInputMode.Custom]: { ...defaultModeData },
    },
    setMobileModeData: () => {},
    updateCurrentModeData: () => {},
    currentModeData: { ...defaultModeData },
  });

export const useBulkSendAmountsInputContext = () =>
  useContext(BulkSendAmountsInputContext);
