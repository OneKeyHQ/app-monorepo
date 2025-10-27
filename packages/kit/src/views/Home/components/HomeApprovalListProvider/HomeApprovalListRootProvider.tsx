import { memo, useMemo } from 'react';

import { ProviderJotaiContextApprovalList } from '@onekeyhq/kit/src/states/jotai/contexts/approvalList/atoms';
import { useJotaiContextRootStore } from '@onekeyhq/kit/src/states/jotai/utils/useJotaiContextRootStore';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function useHomeApprovalListContextStoreInitData() {
  const data = useMemo(
    () => ({
      storeName: EJotaiContextStoreNames.homeApprovalList,
    }),
    [],
  );
  return data;
}

export const HomeApprovalListRootProvider = memo(() => {
  const data = useHomeApprovalListContextStoreInitData();
  const store = useJotaiContextRootStore(data);
  return <ProviderJotaiContextApprovalList store={store} />;
});
HomeApprovalListRootProvider.displayName = 'HomeApprovalListRootProvider';
