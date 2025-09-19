import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../components/AccountSelector/AccountSelectorProvider';

export function PerpsAccountSelectorProviderMirror({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      {children}
    </AccountSelectorProviderMirror>
  );
}
