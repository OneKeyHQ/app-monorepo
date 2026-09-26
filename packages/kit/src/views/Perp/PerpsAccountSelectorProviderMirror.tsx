import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../components/AccountSelector/AccountSelectorProvider';

export function PerpsAccountSelectorProviderMirror({
  children,
  perfDebugName,
}: {
  children: React.ReactNode;
  perfDebugName?: string;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
      perfDebugName={perfDebugName}
    >
      {children}
    </AccountSelectorProviderMirror>
  );
}
