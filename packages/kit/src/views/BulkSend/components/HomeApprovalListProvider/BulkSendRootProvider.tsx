import { memo, useMemo } from 'react';

import { ProviderJotaiContextBulkSend } from '@onekeyhq/kit/src/states/jotai/contexts/bulkSend/atoms';
import { useJotaiContextRootStore } from '@onekeyhq/kit/src/states/jotai/utils/useJotaiContextRootStore';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function useBulkSendContextStoreInitData() {
  const data = useMemo(
    () => ({
      storeName: EJotaiContextStoreNames.bulkSend,
    }),
    [],
  );
  return data;
}

export const BulkSendRootProvider = memo(() => {
  const data = useBulkSendContextStoreInitData();
  const store = useJotaiContextRootStore(data);
  return <ProviderJotaiContextBulkSend store={store} />;
});
BulkSendRootProvider.displayName = 'BulkSendRootProvider';
