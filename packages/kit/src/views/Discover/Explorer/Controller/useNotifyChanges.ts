import { useEffect } from 'react';

import { throttle } from 'lodash';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useIsFocusedInTab } from '../../../../hooks/useIsFocusedInTab';
import { useIsMounted } from '../../../../hooks/useIsMounted';
import { TabRoutes } from '../../../../routes/routesEnum';
import {
  getWebviewWrapperRef,
  pauseDappInteraction,
  resumeDappInteraction,
} from '../explorerUtils';

import { useWebTabs } from './useWebTabs';

import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';

const notifyChanges = throttle(
  (url: string, fromScene?: string) => {
    debugLogger.webview.info('webview notify changed events', url, fromScene);
    backgroundApiProxy.serviceAccount.notifyAccountsChanged();
    backgroundApiProxy.serviceNetwork.notifyChainChanged();
  },
  150,
  {
    leading: false,
    trailing: true,
  },
);

export const useNotifyChanges = () => {
  const isMountedRef = useIsMounted();
  const { tab } = useWebTabs();

  const tabUrl = tab?.url;
  const tabId = tab?.id;

  const webviewRef = getWebviewWrapperRef(tabId);

  const isFocusedInDiscoverTab = useIsFocusedInTab(TabRoutes.Discover);
  useEffect(() => {
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      return;
    }

    const jsBridge = webviewRef?.jsBridge;
    if (!jsBridge) {
      return;
    }
    // only enable message for current focused webview
    if (isFocusedInDiscoverTab) {
      if (platformEnv.isDesktop) {
        resumeDappInteraction();
      }
      // native should resume only if webview is focused
    } else {
      pauseDappInteraction();
    }
    // connect background jsBridge
    backgroundApiProxy.connectBridge(jsBridge);
  }, [webviewRef, isFocusedInDiscoverTab]);

  useEffect(() => {
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      return;
    }
    if (!isMountedRef.current) {
      return;
    }
    if (!tabUrl || !isFocusedInDiscoverTab) {
      return;
    }
    if (!webviewRef) {
      return;
    }
    debugLogger.webview.info('webview isFocused and notifyChanges', tabUrl);

    if (platformEnv.isNative) {
      notifyChanges(tabUrl, 'immediately');
    } else {
      const innerRef = webviewRef?.innerRef as IElectronWebView | undefined;

      if (!innerRef) {
        return;
      }
      // @ts-ignore
      if (innerRef.__domReady) {
        notifyChanges(tabUrl, 'immediately');
      } else {
        const timer = setTimeout(() => {
          notifyChanges(tabUrl, 'setTimeout');
        }, 1000);
        const onDomReady = () => {
          notifyChanges(tabUrl, 'domReady');
          clearTimeout(timer);
        };
        innerRef.addEventListener('dom-ready', onDomReady);

        return () => {
          clearTimeout(timer);
          innerRef.removeEventListener('dom-ready', onDomReady);
        };
      }
    }
  }, [isFocusedInDiscoverTab, isMountedRef, tabUrl, webviewRef]);
};
