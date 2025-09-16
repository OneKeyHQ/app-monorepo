import { Page, YStack } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { PerpCandles } from '../components/PerpCandles';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { MobilePerpMarketHeader } from '../components/TickerBar/MobilePerpMarketHeader';
import { PerpsProviderMirror } from '../PerpsProviderMirror';

function MobilePerpMarket() {
  return (
    <Page>
      <Page.Body px="$0" py="$0">
        <YStack flex={1} bg="$bgApp" gap="$2.5">
          <MobilePerpMarketHeader />

          <YStack flex={1} minHeight={364}>
            <PerpCandles />
          </YStack>

          <YStack flexShrink={0} minHeight={360} bg="$bgApp">
            <PerpOrderBook entry="perpMobileMarket" />
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

function MobilePerpMarketWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <PerpsProviderMirror storeName={EJotaiContextStoreNames.perps}>
        <MobilePerpMarket />
      </PerpsProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default MobilePerpMarketWithProvider;
