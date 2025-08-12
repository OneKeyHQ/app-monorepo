import { useCallback, useEffect, useMemo, useRef } from 'react';

import { HeaderIconButton, Page } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import {
  HYPER_LIQUID_ORIGIN,
  HYPER_LIQUID_TRADE_URL,
} from '@onekeyhq/shared/src/consts/perp';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { SingleAccountAndNetworkSelectorTrigger } from '../../Discovery/components/HeaderRightToolBar';

import type { IWebViewRef } from '../../../components/WebView/types';

const origin = HYPER_LIQUID_ORIGIN;
const url = HYPER_LIQUID_TRADE_URL;

function PerpTradeViewExt() {
  useEffect(() => {
    if (platformEnv.isExtension) {
      void backgroundApiProxy.servicePerp.openExtPerpTab();
      setTimeout(() => {
        window.close();
      }, 300);
    }
  }, []);
  return null;
}

function PerpTradeView() {
  useDebugComponentRemountLog({ name: 'PerpTradePageContainer' });

  const webviewRef = useRef<IWebViewRef | null>(null);

  const webview = useMemo(
    () => (
      <WebView
        id="perp-trade"
        src={url}
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

  const {
    result: connectedAccountsInfo,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      if (!origin) {
        return;
      }
      const connectedAccount =
        await backgroundApiProxy.serviceDApp.findInjectedAccountByOrigin(
          origin,
        );

      return connectedAccount;
    },
    [],
    {
      checkIsFocused: false,
    },
  );

  const afterChangeAccount = useCallback(() => {
    void run();
  }, [run]);

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.DAppConnectUpdate, afterChangeAccount);
    appEventBus.on(EAppEventBusNames.DAppNetworkUpdate, afterChangeAccount);
    return () => {
      appEventBus.off(EAppEventBusNames.DAppConnectUpdate, afterChangeAccount);
      appEventBus.off(EAppEventBusNames.DAppNetworkUpdate, afterChangeAccount);
    };
  }, [afterChangeAccount]);

  const leftHeaderItems = useMemo(() => {
    const accountInfo = connectedAccountsInfo?.[0];
    if (!accountInfo) {
      return null;
    }
    return (
      <>
        <AccountSelectorProviderMirror
          config={{
            sceneName: EAccountSelectorSceneName.discover,
            sceneUrl: origin ?? '',
          }}
          enabledNum={[accountInfo.num]}
          availableNetworksMap={{
            [accountInfo.num]: {
              networkIds: accountInfo.availableNetworkIds,
            },
          }}
        >
          <SingleAccountAndNetworkSelectorTrigger
            origin={origin}
            num={accountInfo.num}
            account={accountInfo}
            afterChangeAccount={afterChangeAccount}
          />
        </AccountSelectorProviderMirror>
      </>
    );
  }, [afterChangeAccount, connectedAccountsInfo]);

  return (
    <Page fullPage>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.PerpTrade}
        customHeaderLeftItems={leftHeaderItems}
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
      {platformEnv.isExtension ? <PerpTradeViewExt /> : <PerpTradeView />}
    </AccountSelectorProviderMirror>
  );
};

export default PagePerpTrade;
