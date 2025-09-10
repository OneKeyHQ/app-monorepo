import { useFocusEffect } from '@react-navigation/native';

import { Page, useMedia } from '@onekeyhq/components';
import { ProviderJotaiContextHyperliquid } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { PerpsGlobalEffects } from '../components/PerpsGlobalEffects';
import { useHyperliquidSession } from '../hooks';
import { PerpDesktopLayout } from '../layouts/PerpDesktopLayout';
import { PerpMobileLayout } from '../layouts/PerpMobileLayout';

function PerpLayout() {
  const { gtMd } = useMedia();
  if (gtMd) {
    return <PerpDesktopLayout />;
  }
  return <PerpMobileLayout />;
}

function PerpContent() {
  useHyperliquidSession();

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Perp}
      />
      <Page.Body>
        <PerpLayout />
      </Page.Body>
    </Page>
  );
}

export default function Perp() {
  // useDebugComponentRemountLog({ name: 'Perp' });
  useFocusEffect(() => {
    void backgroundApiProxy.serviceWebviewPerp.updateBuilderFeeConfigByServer();
  });
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ProviderJotaiContextHyperliquid>
        <PerpsGlobalEffects />
        <PerpContent />
      </ProviderJotaiContextHyperliquid>
    </AccountSelectorProviderMirror>
  );
}
