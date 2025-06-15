import { Page, useMedia } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { ProviderJotaiContextMarketV2 } from '../../../states/jotai/contexts/marketV2';

import { MarketHomeContent } from './components/MarketHomeContent';
import { MarketHomeContentMobile } from './components/MarketHomeContentMobile';

function MarketHome() {
  const { md } = useMedia();

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Market}
      />
      <Page.Body>
        {md ? <MarketHomeContentMobile /> : <MarketHomeContent />}
      </Page.Body>
    </Page>
  );
}

export function MarketHomeV2() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ProviderJotaiContextMarketV2>
        <MarketHome />
      </ProviderJotaiContextMarketV2>
    </AccountSelectorProviderMirror>
  );
}
