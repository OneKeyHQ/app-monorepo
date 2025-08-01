import { memo } from 'react';

import { withApprovalListProvider } from '../../../states/jotai/contexts/approvalList';

function ApprovalListContainer() {
  return <div>ApprovalListContainer</div>;
}

const ApprovalListContainerWithProvider = memo(
  withApprovalListProvider(ApprovalListContainer),
);

export { ApprovalListContainerWithProvider };
