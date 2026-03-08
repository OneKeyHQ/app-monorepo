import { createContext, useContext } from 'react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  IApproveInfo,
  ITransferInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type {
  EFeeType,
  ESendFeeStatus,
  IFeeSelectorItem,
  IGasEIP1559,
  IGasLegacy,
  ISendSelectedFeeInfo,
} from '@onekeyhq/shared/types/fee';
import type { IToken } from '@onekeyhq/shared/types/token';

export type IBulkSendFeeState = {
  feeStatus: ESendFeeStatus;
  errMessage: string;
  isInitialized: boolean; // true after first successful fee estimation
  feeSelectorItems: IFeeSelectorItem[];
  selectedFee: {
    feeType: EFeeType;
    presetIndex: number;
  };
  totalFeeNative: string;
  totalFeeFiat: string;
  nativeSymbol: string;
  feeInfos: ISendSelectedFeeInfo[];
  // Per-tx gas info from batch estimation (each tx may have different gas limits)
  perTxFeeInfos?: { gas?: IGasLegacy[]; gasEIP1559?: IGasEIP1559[] }[];
};

export type IBulkSendReviewContext = {
  // Static data from route params
  networkId: string;
  accountId: string | undefined;
  tokenInfo: IToken;
  transfersInfo: ITransferInfo[];
  bulkSendMode: EBulkSendMode;
  totalTokenAmount: string;
  totalFiatAmount: string;
  isInModal?: boolean;

  // Fetched data
  networkImageUri: string | undefined;

  // Original data for reset
  initialApprovesInfoRef: React.MutableRefObject<IApproveInfo[]>;

  // Mutable state
  approvesInfo: IApproveInfo[];
  setApprovesInfo: React.Dispatch<React.SetStateAction<IApproveInfo[]>>;
  unsignedTxs: IUnsignedTxPro[];
  setUnsignedTxs: React.Dispatch<React.SetStateAction<IUnsignedTxPro[]>>;

  // Fee state
  feeState: IBulkSendFeeState;
  setFeeState: React.Dispatch<React.SetStateAction<IBulkSendFeeState>>;

  // Submit state
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
};

export const BulkSendReviewContext = createContext<IBulkSendReviewContext>({
  networkId: '',
  accountId: undefined,
  tokenInfo: {
    address: '',
    name: '',
    symbol: '',
    decimals: 18,
    isNative: false,
  },
  transfersInfo: [],
  bulkSendMode: EBulkSendMode.OneToMany,
  totalTokenAmount: '0',
  totalFiatAmount: '0',
  isInModal: undefined,

  networkImageUri: undefined,

  initialApprovesInfoRef: { current: [] },

  approvesInfo: [],
  setApprovesInfo: () => {},
  unsignedTxs: [],
  setUnsignedTxs: () => {},

  feeState: {
    feeStatus: 'Loading' as ESendFeeStatus,
    errMessage: '',
    isInitialized: false,
    feeSelectorItems: [],
    selectedFee: {
      feeType: 'Standard' as EFeeType,
      presetIndex: 1,
    },
    totalFeeNative: '0',
    totalFeeFiat: '0',
    nativeSymbol: '',
    feeInfos: [],
  },
  setFeeState: () => {},

  isSubmitting: false,
  setIsSubmitting: () => {},
});

export const useBulkSendReviewContext = () => useContext(BulkSendReviewContext);
