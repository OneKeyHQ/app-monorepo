import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Button,
  HeaderIconButton,
  IconButton,
  Page,
  Tooltip,
  useShortcuts,
} from '@onekeyhq/components';
import { DelayedRender } from '@onekeyhq/components/src/hocs/DelayedRender';
import {
  HYPER_LIQUID_ORIGIN,
  HYPER_LIQUID_WEBVIEW_TRADE_URL,
} from '@onekeyhq/shared/src/consts/perp';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { MultipleClickStack } from '../../../components/MultipleClickStack';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { WebViewWithFeatures } from '../../../components/WebView/WebViewWithFeatures';
import { useShortcutsRouteStatus } from '../../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { SingleAccountAndNetworkSelectorTrigger } from '../../Discovery/components/HeaderRightToolBar';

import type {
  IElectronWebView,
  IWebViewRef,
} from '../../../components/WebView/types';
import type { WebView as ReactNativeWebView } from 'react-native-webview';

const origin = HYPER_LIQUID_ORIGIN;
const url = HYPER_LIQUID_WEBVIEW_TRADE_URL;

function usePerpPageShortcuts({
  webviewRef,
}: {
  webviewRef: React.RefObject<IWebViewRef | null>;
}) {
  const { isAtPerpTab, shouldReloadAppByCmdR } = useShortcutsRouteStatus();

  const refresh = useCallback(() => {
    if (isAtPerpTab.current) {
      try {
        console.log('refresh webview@@@@');
        webviewRef.current?.reload?.();
      } catch {
        // empty
      }
    } else if (shouldReloadAppByCmdR.current) {
      void globalThis.desktopApiProxy?.system?.reload?.();
    }
  }, [webviewRef, isAtPerpTab, shouldReloadAppByCmdR]);

  const handleShortcuts = useCallback(
    (data: EShortcutEvents) => {
      if (data === EShortcutEvents.Refresh) {
        refresh();
      }
    },
    [refresh],
  );

  useShortcuts(undefined, handleShortcuts);
}

function WebviewPerpTradeViewExt() {
  useEffect(() => {
    if (platformEnv.isExtension) {
      void backgroundApiProxy.serviceWebviewPerp.openExtPerpTab();
      setTimeout(() => {
        window.close();
      }, 300);
    }
  }, []);
  return null;
}

function WebviewPerpTradeView() {
  const intl = useIntl();

  useDebugComponentRemountLog({ name: 'PerpTradePageContainer' });

  const webviewRef = useRef<IWebViewRef | null>(null);
  usePerpPageShortcuts({ webviewRef });

  const [isWebViewLoading, setIsWebViewLoading] = useState(false);
  const onDidStartLoading = useCallback(() => {
    setIsWebViewLoading(true);
  }, []);
  const onDidFinishLoad = useCallback(() => {
    setIsWebViewLoading(false);
  }, []);
  const onDidStartNavigation = useCallback(() => {
    setIsWebViewLoading(true);
  }, []);

  const webview = useMemo(
    () => (
      <WebViewWithFeatures
        // important: if set to false, the webview will not notify the dapp about the account changes first time
        features={{ notifyChangedEventsToDappOnFocus: true }}
        id="perp-trade"
        src={url}
        onWebViewRef={(ref) => {
          // Simple ref handling for the perp trade
          console.log('PerpTrade WebView ref ready:', ref);
          webviewRef.current = ref;
        }}
        allowpopups
        onDidStartLoading={onDidStartLoading}
        onDidStartNavigation={onDidStartNavigation}
        onDidFinishLoad={onDidFinishLoad}
        onDidStopLoading={onDidFinishLoad}
        onDidFailLoad={onDidFinishLoad}
      />
    ),
    [onDidFinishLoad, onDidStartLoading, onDidStartNavigation],
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

  const [showConnectButton, setShowConnectButton] = useState(false);

  const isConnectingRef = useRef(false);
  const leftHeaderItems = useMemo(() => {
    const accountInfo = connectedAccountsInfo?.[0];
    if (!accountInfo) {
      if (isLoading) {
        return null;
      }
      if (showConnectButton) {
        return (
          <DelayedRender delay={600}>
            <Button
              isLoading={isConnectingRef.current}
              onPress={async () => {
                try {
                  if (isConnectingRef.current) {
                    return;
                  }
                  isConnectingRef.current = true;
                  await backgroundApiProxy.serviceWebviewPerp.connectToDapp();
                } finally {
                  isConnectingRef.current = false;
                }
              }}
            >
              {intl.formatMessage({ id: ETranslations.global_connect })}
            </Button>
          </DelayedRender>
        );
      }
      return (
        <MultipleClickStack
          showDevBgColor
          w="$10"
          h="$10"
          onPress={() => {
            setShowConnectButton(true);
          }}
        />
      );
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

          <Tooltip
            renderTrigger={
              <IconButton
                icon="BrokenLinkOutline"
                onPress={() => {
                  void backgroundApiProxy.serviceWebviewPerp.disconnectFromDapp();
                }}
              />
            }
            renderContent={intl.formatMessage({
              id: ETranslations.explore_disconnect,
            })}
          />
        </AccountSelectorProviderMirror>
      </>
    );
  }, [
    afterChangeAccount,
    connectedAccountsInfo,
    intl,
    isLoading,
    showConnectButton,
  ]);

  return (
    <Page fullPage>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.WebviewPerpTrade}
        customHeaderLeftItems={leftHeaderItems}
        renderCustomHeaderRightItems={({ fixedItems }) => (
          <>
            <HeaderIconButton
              key="perp-trade-refresh"
              title={
                <Tooltip.Text shortcutKey={EShortcutEvents.Refresh}>
                  {intl.formatMessage({ id: ETranslations.global_refresh })}
                </Tooltip.Text>
              }
              icon={
                isWebViewLoading
                  ? 'CrossedLargeOutline'
                  : 'RotateClockwiseOutline'
              }
              onPress={() => {
                if (isWebViewLoading) {
                  if (platformEnv.isDesktop) {
                    const innerRef = webviewRef.current
                      ?.innerRef as IElectronWebView;
                    innerRef?.stop?.();
                  }
                  if (platformEnv.isNative) {
                    (
                      webviewRef.current?.innerRef as ReactNativeWebView
                    )?.stopLoading?.();
                  }
                } else {
                  // refresh webview
                  webviewRef.current?.reload?.();
                }
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

const PageWebviewPerpTrade = () => {
  useDebugComponentRemountLog({ name: 'PageWebviewPerpTrade' });
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
      {platformEnv.isExtension ? (
        <WebviewPerpTradeViewExt />
      ) : (
        <WebviewPerpTradeView />
      )}
    </AccountSelectorProviderMirror>
  );
};

export default PageWebviewPerpTrade;
