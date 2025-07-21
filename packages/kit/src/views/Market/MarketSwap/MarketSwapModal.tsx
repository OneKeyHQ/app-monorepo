import { Page, View } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { SwapPanelWrap } from '../MarketDetailV2/components/SwapPanel/SwapPanelWrap';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

export default function MarketSwapModal() {
  return (
    <Page>
      <Page.Header title="Swap" />
      <Page.Body>
        <AccountSelectorProviderMirror
          config={{
            sceneName: EAccountSelectorSceneName.home,
            sceneUrl: '',
          }}
          enabledNum={[0]}
        >
          <MarketWatchListProviderMirrorV2
            storeName={EJotaiContextStoreNames.marketWatchListV2}
          >
            <View p="$4">
              <SwapPanelWrap />
            </View>
          </MarketWatchListProviderMirrorV2>
        </AccountSelectorProviderMirror>
      </Page.Body>
    </Page>
  );
}
