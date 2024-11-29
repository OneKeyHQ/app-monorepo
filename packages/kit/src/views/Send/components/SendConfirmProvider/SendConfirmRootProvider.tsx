import { memo, useMemo } from 'react';

import { ProviderJotaiContextSendConfirm } from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm/atoms';
import { useJotaiContextRootStore } from '@onekeyhq/kit/src/states/jotai/utils/useJotaiContextRootStore';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function useSendConfirmContextStoreInitData() {
  const data = useMemo(
    () => ({
      storeName: EJotaiContextStoreNames.sendConfirm,
    }),
    [],
  );
  return data;
}

export const SendConfirmRootProvider = memo(() => {
  const data = useSendConfirmContextStoreInitData();
  const store = useJotaiContextRootStore(data);
  return <ProviderJotaiContextSendConfirm store={store} />;
});
SendConfirmRootProvider.displayName = 'SendConfirmRootProvider';
