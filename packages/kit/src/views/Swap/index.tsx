import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../components/AccountSelector';

import SwapPageContainer from './pages/SwapPageContainer';

const Swap = () => (
  <AccountSelectorProviderMirror
    config={{
      sceneName: EAccountSelectorSceneName.swap,
      sceneUrl: '',
    }}
    enabledNum={[0, 1]}
  >
    <SwapPageContainer />
  </AccountSelectorProviderMirror>
);

export default Swap;
