import type { IContractApproval } from '@onekeyhq/shared/types/approval';

export enum EModalApprovalManagementRoutes {
  ApprovalDetails = 'ApprovalManagement_ApprovalDetails',
}

export type IModalApprovalManagementParamList = {
  [EModalApprovalManagementRoutes.ApprovalDetails]: {
    approval: IContractApproval;
    isSelectMode?: boolean;
    onSelected?: (approval: IContractApproval) => void;
  };
};
