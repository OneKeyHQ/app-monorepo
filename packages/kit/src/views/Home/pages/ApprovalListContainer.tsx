import { memo } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ApprovalListView } from '../../../components/ApprovalListView';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useApprovalListActions,
  withApprovalListProvider,
} from '../../../states/jotai/contexts/approvalList';

function ApprovalListContainer() {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });

  const { updateApprovalList, updateTokenMap, updateContractMap } =
    useApprovalListActions().current;

  usePromiseResult(async () => {
    if (!account || !network) return;

    if (network.isAllNetworks) return;

    await backgroundApiProxy.serviceApproval.abortFetchAccountApprovals();

    const resp = await backgroundApiProxy.serviceApproval.fetchAccountApprovals(
      {
        accountId: account.id,
        networkId: network.id,
        accountAddress: account.address,
      },
    );

    updateApprovalList({ data: resp.approvals });
    updateTokenMap({ data: resp.tokens });
    updateContractMap({ data: resp.addressMap });
  }, [account, network, updateApprovalList, updateTokenMap, updateContractMap]);

  return <ApprovalListView inTabList />;
}

const ApprovalListContainerWithProvider = memo(
  withApprovalListProvider(ApprovalListContainer),
);

export { ApprovalListContainerWithProvider };
