import { useMemo, useRef } from 'react';

import { HeaderIconButton, Page } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';

import type { IWebViewRef } from '../../../components/WebView/types';

function PerpTradeView() {
  useDebugComponentRemountLog({ name: 'PerpTradePageContainer' });

  const webviewRef = useRef<IWebViewRef | null>(null);

  const webview = useMemo(
    () => (
      <WebView
        id="perp-trade"
        // src="https://www.bing.com"
        src="https://app.hyperliquid.xyz/trade?$$$$onekey$$$$=true"
        onWebViewRef={(ref) => {
          // Simple ref handling for the perp trade
          console.log('PerpTrade WebView ref ready:', ref);
          webviewRef.current = ref;
        }}
        allowpopups
      />
    ),
    [],
  );

  return (
    <Page fullPage>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.PerpTrade}
        renderCustomHeaderRightItems={({ fixedItems }) => (
          <>
            <HeaderIconButton
              key="perp-trade-refresh"
              title="Refresh"
              icon="RefreshCwOutline"
              onPress={() => {
                // refresh webview
                webviewRef.current?.reload?.();
              }}
              testID="header-right-perp-trade-refresh"
            />
            {fixedItems}
          </>
        )}
      />
      <Page.Body>{webview}</Page.Body>
    </Page>
  );
}

const PagePerpTrade = () => {
  useDebugComponentRemountLog({ name: 'PerpTradePage' });
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <PerpTradeView />
    </AccountSelectorProviderMirror>
  );
};

export default PagePerpTrade;
