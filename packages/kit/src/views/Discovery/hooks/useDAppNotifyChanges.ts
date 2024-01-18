import { useEffect, useState } from 'react';

import { throttle } from 'lodash';

import { useIsMounted } from '@onekeyhq/components/src/hocs/Provider/hooks/useIsMounted';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { ETabRoutes } from '../../../routes/Tab/type';
import { getWebviewWrapperRef } from '../utils/explorerUtils';

import { useWebTabDataById } from './useWebTabs';

import type { IElectronWebView } from '../components/WebView/types';

const notifyChanges = throttle((url: string, fromScene?: string) => {
  console.log('webview notify changed events: ', url, fromScene);
  void backgroundApiProxy.serviceDiscovery.notifyTest();
});

export function useDAppNotifyChanges({ tabId }: { tabId: string | null }) {
  const isMountedRef = useIsMounted();
  const { tab } = useWebTabDataById(tabId ?? '');

  const webviewRef = getWebviewWrapperRef(tabId ?? '');
  const [isFocusedInDiscoveryTab, setIsFocusedInDiscoveryTab] = useState(false);
  useListenTabFocusState([ETabRoutes.MultiTabBrowser], (isFocus) => {
    setIsFocusedInDiscoveryTab(isFocus);
  });

  // reconnect jsBridge
  useEffect(() => {
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      return;
    }
    const jsBridge = webviewRef?.jsBridge;
    if (!jsBridge) {
      return;
    }
    backgroundApiProxy.connectBridge(jsBridge);
  }, [webviewRef, isFocusedInDiscoveryTab]);

  // sent accountChanged notification
  useEffect(() => {
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      console.log('not native or not desktop');
      return;
    }

    if (!isMountedRef.current) {
      console.log('not mounted');
      return;
    }

    if (!tab?.url || !isFocusedInDiscoveryTab) {
      console.log('no url or not focused');
      return;
    }

    if (!webviewRef) {
      console.log('no webviewRef');
      return;
    }

    console.log('webview isFocused and notifyChanges: ', tab.url);
    if (platformEnv.isDesktop) {
      const innerRef = webviewRef?.innerRef as IElectronWebView | undefined;

      if (!innerRef) {
        return;
      }
      // @ts-expect-error
      if (innerRef.__dy) {
        notifyChanges(tab.url, 'immediately');
      } else {
        const timer = setTimeout(() => {
          notifyChanges(tab.url, 'setTimeout');
        }, 1000);
        const onDomReady = () => {
          notifyChanges(tab.url, 'domReady');
          clearTimeout(timer);
        };
        innerRef.addEventListener('dom-ready', onDomReady);

        return () => {
          clearTimeout(timer);
          innerRef.removeEventListener('dom-ready', onDomReady);
        };
      }
    }
  }, [isFocusedInDiscoveryTab, tab?.url, webviewRef, isMountedRef]);
}
