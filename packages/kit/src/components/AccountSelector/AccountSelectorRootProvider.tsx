import { memo, useMemo } from 'react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorJotaiProvider } from '../../states/jotai/contexts/accountSelector';
import { useJotaiContextRootStore } from '../../states/jotai/utils/useJotaiContextRootStore';

import { AccountSelectorEffects } from './AccountSelectorEffects';
import { AccountSelectorStorageInit } from './AccountSelectorStorageInit';

function AccountSelectorRootProviderCmp({
  enabledNumStr,
  sceneName,
  sceneUrl,
}: {
  enabledNumStr: string;
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
}) {
  const config = useMemo(
    () => ({ sceneName, sceneUrl }),
    [sceneName, sceneUrl],
  );
  const enabledNum = useMemo(
    () => enabledNumStr.split(',').map((n) => Number(n)),
    [enabledNumStr],
  );

  const data = useMemo(
    () => ({
      storeName: EJotaiContextStoreNames.accountSelector,
      accountSelectorInfo: {
        sceneName: config.sceneName,
        sceneUrl: config.sceneUrl,
        enabledNum,
      },
    }),
    [config.sceneName, config.sceneUrl, enabledNum],
  );
  const store = useJotaiContextRootStore(data);
  return (
    <AccountSelectorJotaiProvider store={store} config={config}>
      <AccountSelectorStorageInit />
      {enabledNum.map((num) => (
        <AccountSelectorEffects key={num} num={num} />
      ))}
    </AccountSelectorJotaiProvider>
  );
}
export const AccountSelectorRootProvider = memo(AccountSelectorRootProviderCmp);
