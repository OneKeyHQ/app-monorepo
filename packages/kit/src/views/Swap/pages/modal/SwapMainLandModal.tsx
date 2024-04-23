import { memo } from 'react';

import { Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import SwapMainLand from '../components/SwapMainLand';
import { withSwapProvider } from '../WithSwapProvider';

const SwapMainLandModalPage = () => (
  <Page skipLoading={platformEnv.isNativeIOS}>
    <Page.Header title="Swap" />
    <SwapMainLand hiddenSwapHeader />
  </Page>
);

const SwapMainLandModalWithProvider = memo(
  withSwapProvider(SwapMainLandModalPage),
);
export default function SwapMainLandModal() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.swap,
      }}
      enabledNum={[0, 1]}
    >
      <SwapMainLandModalWithProvider />
    </AccountSelectorProviderMirror>
  );
}
