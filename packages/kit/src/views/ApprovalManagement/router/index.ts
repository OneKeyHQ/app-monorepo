import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IModalApprovalManagementParamList } from '@onekeyhq/shared/src/routes/approvalManagement';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const ApprovalDetails = LazyLoadPage(() => import('../pages/ApprovalDetails'));
const RevokeSuggestion = LazyLoadPage(
  () => import('../pages/RevokeSuggestion'),
);

export const ModalApprovalManagementStack: IModalFlowNavigatorConfig<
  EModalApprovalManagementRoutes,
  IModalApprovalManagementParamList
>[] = [
  {
    name: EModalApprovalManagementRoutes.ApprovalDetails,
    component: ApprovalDetails,
  },
  {
    name: EModalApprovalManagementRoutes.RevokeSuggestion,
    component: RevokeSuggestion,
  },
];
