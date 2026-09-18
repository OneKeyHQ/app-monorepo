import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { DustSweepPage } from '../../../DustSweep/DustSweepPage';

export default function DustSweepModal() {
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.swap }}
      enabledNum={[0]}
    >
      <DustSweepPage />
    </AccountSelectorProviderMirror>
  );
}
