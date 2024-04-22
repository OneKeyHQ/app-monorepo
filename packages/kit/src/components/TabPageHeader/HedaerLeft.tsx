import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../AccountSelector';

export function HeaderLeft({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName,
        sceneUrl: '',
      }}
    >
      <AccountSelectorTriggerHome num={0} />
    </AccountSelectorProviderMirror>
  );
}
