import { useRef } from 'react';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

import { useInitialNotification } from './hooks';

export const NotificationHandlerContainerNative = () => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const activeAccountRef = useRef(activeAccount);
  activeAccountRef.current = activeAccount;

  useInitialNotification(activeAccountRef);
  return null;
};

export const NotificationHandlerContainer = () => {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <NotificationHandlerContainerNative />
    </AccountSelectorProviderMirror>
  );
};
