import { memo } from 'react';

import { useRoute } from '@react-navigation/native';

import type {
  EModalApprovalManagementRoutes,
  IModalApprovalManagementParamList,
} from '@onekeyhq/shared/src/routes/approvalManagement';

import { ApprovalListView } from '../../../components/ApprovalListView';
import { HomeApprovalListProviderMirror } from '../../Home/components/HomeApprovalListProvider/HomeApprovalListProviderMirror';

import type { RouteProp } from '@react-navigation/core';

function ApprovalList() {
  const route =
    useRoute<
      RouteProp<
        IModalApprovalManagementParamList,
        EModalApprovalManagementRoutes.ApprovalList
      >
    >();
  const { accountId, networkId } = route.params;
  return (
    <ApprovalListView withHeader accountId={accountId} networkId={networkId} />
  );
}

const ApprovalListWithProvider = memo(() => {
  return (
    <HomeApprovalListProviderMirror>
      <ApprovalList />
    </HomeApprovalListProviderMirror>
  );
});

ApprovalListWithProvider.displayName = 'ApprovalListWithProvider';

export default ApprovalListWithProvider;
