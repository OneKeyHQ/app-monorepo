import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProvider } from '../../components/AccountSelector';

import SwapPageContainer from './container/SwapPageContainer';

const Swap = () => (
  <AccountSelectorProvider
    config={{
      sceneName: EAccountSelectorSceneName.swap,
      sceneUrl: '',
    }}
    enabledNum={[0, 1]}
  >
    <SwapPageContainer />
  </AccountSelectorProvider>
);

export default Swap;
