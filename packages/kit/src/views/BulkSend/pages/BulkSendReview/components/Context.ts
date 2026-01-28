import { createContext, useContext } from 'react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

export type IBulkSendReviewContext = {
  // Static data from route params
  networkId: string;
  accountId: string | undefined;
  tokenInfo: IToken;
  transfersInfo: ITransferInfo[];
  bulkSendMode: EBulkSendMode;
  totalTokenAmount: string;
  totalFiatAmount: string;

  // Fetched data
  networkImageUri: string | undefined;

  // Mutable state
  approvesInfo: IApproveInfo[];
  setApprovesInfo: React.Dispatch<React.SetStateAction<IApproveInfo[]>>;
  unsignedTxs: IUnsignedTxPro[];
  setUnsignedTxs: React.Dispatch<React.SetStateAction<IUnsignedTxPro[]>>;
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

  networkImageUri: undefined,

  approvesInfo: [],
  setApprovesInfo: () => {},
  unsignedTxs: [],
  setUnsignedTxs: () => {},
});

export const useBulkSendReviewContext = () => useContext(BulkSendReviewContext);
