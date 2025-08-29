import type {
  EContractApprovalAlertType,
  IContractApproval,
} from '@onekeyhq/shared/types/approval';

import type { IAddressInfo } from '../../types/address';
import type { IToken } from '../../types/token';

export enum EModalApprovalManagementRoutes {
  ApprovalDetails = 'ApprovalDetails',
  RevokeSuggestion = 'RevokeSuggestion',
  ApprovalList = 'ApprovalList',
}

export type IModalApprovalManagementParamList = {
  [EModalApprovalManagementRoutes.ApprovalDetails]: {
    approval: IContractApproval;
    isSelectMode?: boolean;
    onSelected?: (params: { selectedTokens: Record<string, boolean> }) => void;
    selectedTokens?: Record<string, boolean>;
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
    alertType: EContractApprovalAlertType;
  };
  [EModalApprovalManagementRoutes.ApprovalList]: {
    accountId: string;
    networkId: string;
  };
};
