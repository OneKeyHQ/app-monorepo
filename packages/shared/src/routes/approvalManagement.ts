import type {
  EContractApprovalAlertType,
  IContractApproval,
} from '@onekeyhq/shared/types/approval';

export enum EModalApprovalManagementRoutes {
  ApprovalDetails = 'ApprovalDetails',
  RevokeSuggestion = 'ApprovalList',
}

export type IModalApprovalManagementParamList = {
  [EModalApprovalManagementRoutes.ApprovalDetails]: {
    approval: IContractApproval;
    isSelectMode?: boolean;
    onSelected?: (approval: IContractApproval) => void;
  };
  [EModalApprovalManagementRoutes.RevokeSuggestion]: {
    approvals: IContractApproval[];
    alertType: EContractApprovalAlertType;
  };
};
