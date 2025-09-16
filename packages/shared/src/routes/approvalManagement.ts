import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import type { IAddressInfo } from '../../types/address';
import type { IToken } from '../../types/token';

export enum EModalApprovalManagementRoutes {
  ApprovalDetails = 'ApprovalDetails',
  RevokeSuggestion = 'RevokeSuggestion',
  ApprovalList = 'ApprovalList',
  BulkRevoke = 'BulkRevoke',
  TxConfirm = 'TxConfirm',
}

export type IModalApprovalManagementParamList = {
  [EModalApprovalManagementRoutes.ApprovalDetails]: {
    approval: IContractApproval;
    isSelectMode?: boolean;
    onSelected?: (params: { selectedTokens: Record<string, boolean> }) => void;
    selectedTokens?: Record<string, boolean>;
    tokenMap?: Record<
      string,
      {
        price: string;
        price24h: string;
        info: IToken;
      }
    >;
    contractMap?: Record<string, IAddressInfo>;
  };
  [EModalApprovalManagementRoutes.RevokeSuggestion]: {
    accountId: string;
    networkId: string;
    approvals: IContractApproval[];
    contractMap: Record<string, IAddressInfo>;
    tokenMap: Record<
      string,
      {
        price: string;
        price24h: string;
        info: IToken;
      }
    >;
    autoShow?: boolean;
  };
  [EModalApprovalManagementRoutes.ApprovalList]: {
    walletId: string;
    accountId: string;
    networkId: string;
    isBulkRevokeMode?: boolean;
  };
  [EModalApprovalManagementRoutes.BulkRevoke]: {
    unsignedTxs: IUnsignedTxPro[];
    contractMap: Record<string, IAddressInfo>;
  };
};
