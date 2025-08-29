import React from 'react';

import { Page } from '@onekeyhq/components';
import { ProviderJotaiContextHyperliquid } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { useHyperliquidSession } from '../hooks';

import { PerpDesktopLayout } from '../layouts/PerpDesktopLayout';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { usePerpNetworkLock } from '../hooks/usePerpNetworkLock';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useFocusEffect } from '@react-navigation/native';

function PerpContent() {
  usePerpNetworkLock();
  useHyperliquidSession();

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.perp}
        tabRoute={ETabRoutes.Perp}
      />
      <Page.Body>
        <PerpDesktopLayout />
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
        <PerpContent />
      </ProviderJotaiContextHyperliquid>
    </AccountSelectorProviderMirror>
  );
}