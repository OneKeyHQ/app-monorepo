import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

export default function useActiveTabDAppInfo() {
  const intl = useIntl();
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  const { result, run } = usePromiseResult(
    () =>
      new Promise<{
        url: string;
        origin: string;
        showFloatingPanel: boolean;
        connectedAccountsInfo: IConnectionAccountInfoWithNum[] | null;
        faviconUrl: string | undefined;
        originFaviconUrl: string | undefined;
        connectLabel: string;
        networkIcons: string[];
        addressLabel: string;
      } | null>((resolve) => {
        chrome.tabs.query(
          { active: true, lastFocusedWindow: true },
          async (tabs) => {
            if (tabs[0]) {
              try {
                let url = tabs[0]?.url;
                if (!url) {
                  url = await backgroundApiProxy.serviceDApp.getLastFocusUrl();
                }
                console.log('=====>>>>useActiveTabDAppInfo url: ', url);
                const currentOrigin = new URL(url ?? '').origin;
                const hostName = new URL(currentOrigin).hostname;
                const connectLabel = intl.formatMessage(
                  { id: ETranslations.dapp_connect_connect_to_website },
                  { url: hostName },
                );
                const connectedAccountsInfo =
                  (await backgroundApiProxy.serviceDApp.findInjectedAccountByOrigin(
                    currentOrigin,
                  )) ?? [];
                const networkIcons = await Promise.all(
                  connectedAccountsInfo.map(async (accountInfo) => {
                    const network =
                      await backgroundApiProxy.serviceNetwork.getNetwork({
                        networkId: accountInfo.networkId,
                      });
                    return network.logoURI ?? '';
                  }),
                );
                let addressLabel = '';
                if (connectedAccountsInfo.length > 0) {
                  if (connectedAccountsInfo.length === 1) {
                    addressLabel = accountUtils.shortenAddress({
                      address: connectedAccountsInfo[0].address,
                    });
                  } else {
                    addressLabel = intl.formatMessage(
                      { id: ETranslations.global_count_addresses },
                      { count: connectedAccountsInfo.length },
                    );
                  }
                }
                const faviconUrl =
                  await backgroundApiProxy.serviceDiscovery.buildWebsiteIconUrl(
                    currentOrigin,
                    40,
                  );
                resolve({
                  url: tabs[0].url ?? '',
                  origin: currentOrigin,
                  showFloatingPanel: (connectedAccountsInfo ?? []).length > 0,
                  connectedAccountsInfo,
                  faviconUrl,
                  originFaviconUrl: tabs[0].favIconUrl,
                  connectLabel,
                  networkIcons,
                  addressLabel,
                });
              } catch (error) {
                console.error('DappConnectExtensionPanel error:', error);
                resolve(null);
              }
            } else {
              resolve(null);
            }
          },
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTabId],
    { checkIsFocused: false },
  );

  useEffect(() => {
    const handleTabChange = (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => {
      if (changeInfo.status === 'complete' && tab.active) {
        setActiveTabId(tabId);
      }
    };

    const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      setActiveTabId(activeInfo.tabId);
    };

    chrome.tabs.onUpdated.addListener(handleTabChange);
    chrome.tabs.onActivated.addListener(handleTabActivated);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        setActiveTabId(tabs[0].id ?? null);
      }
    });

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabChange);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, []);

  useEffect(() => {
    const fn = () => {
      setTimeout(() => {
        void run();
      }, 300);
    };
    appEventBus.on(EAppEventBusNames.DAppConnectUpdate, run);
    appEventBus.on(EAppEventBusNames.DAppLastFocusUrlUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.DAppConnectUpdate, run);
      appEventBus.off(EAppEventBusNames.DAppLastFocusUrlUpdate, fn);
    };
  }, [run]);

  return { result, refreshConnectionInfo: run };
}
