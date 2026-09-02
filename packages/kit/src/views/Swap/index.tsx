import { Spinner, Stack } from '@onekeyhq/components';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../components/AccountSelector';

import SwapPageContainer from './pages/SwapPageContainer';

function SwapStorageReadyFallback() {
  return (
    <Stack flex={1} alignItems="center" justifyContent="center">
      <Spinner size="large" />
    </Stack>
  );
}

const Swap = () => {
  useDebugComponentRemountLog({ name: 'SwapRoutePage' });

  return (
    <AccountSelectorProviderMirror
      perfDebugName="swap-route"
      config={{
        sceneName: EAccountSelectorSceneName.swap,
        sceneUrl: '',
      }}
      enabledNum={[0, 1]}
      storageReadyFallback={<SwapStorageReadyFallback />}
    >
      <SwapPageContainer />
    </AccountSelectorProviderMirror>
  );
};

export default Swap;
