import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useGeneral } from '@onekeyhq/kit/src/hooks/redux';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { ChainWebEmbedViewCardano } from './ChainWebEmbedViewCardano';
import { ChainWebEmbedViewMonero } from './ChainWebEmbedViewMonero';

function ChainWebEmbed() {
  const { activeNetworkId } = useGeneral();
  const [usedNetworks, setUsedNetworks] = useState<string[]>([]);
  const usedNetworksRef = useRef<string[]>([]);

  const cardanoRef = useRef(null);
  const cardanoCallbackRef = useRef<() => void>();
  const cardanoWebviewCallback = useCallback(() => {
    debugLogger.common.debug('execute cardano webviewCallback, 2');
    cardanoCallbackRef.current?.();
  }, []);

  const moneroRef = useRef(null);
  const moneroCallbackRef = useRef<() => void>();
  const moneroWebviewCallback = useCallback(() => {
    debugLogger.common.debug('execute monero webviewCallback, 2');
    moneroCallbackRef.current?.();
  }, []);

  const webEmbedMap: {
    [index: string]: {
      Component: React.ForwardRefExoticComponent<
        { callback: (() => void) | null } & React.RefAttributes<unknown>
      >;
      chainRef: React.MutableRefObject<null>;
      chainCallbackRef: React.MutableRefObject<(() => void) | undefined>;
      webviewCallback: () => void;
    };
  } = useMemo(
    () => ({
      [OnekeyNetwork.ada]: {
        Component: ChainWebEmbedViewCardano,
        chainRef: cardanoRef,
        chainCallbackRef: cardanoCallbackRef,
        webviewCallback: cardanoWebviewCallback,
      },
      [OnekeyNetwork.xmr]: {
        Component: ChainWebEmbedViewMonero,
        chainRef: moneroRef,
        chainCallbackRef: moneroCallbackRef,
        webviewCallback: moneroWebviewCallback,
      },
    }),
    [cardanoWebviewCallback, moneroWebviewCallback],
  );

  // will this trigger on swap?
  useEffect(() => {
    if (activeNetworkId) {
      usedNetworksRef.current = [activeNetworkId];
      setUsedNetworks([activeNetworkId]);
    }
  }, [activeNetworkId]);

  useEffect(() => {
    const onCheckWebView = (resolve: () => void, networkId: string) => {
      const chainRef = webEmbedMap[networkId]?.chainRef;
      const chainCallbackRef = webEmbedMap[networkId]?.chainCallbackRef;

      if (!chainRef || !chainCallbackRef) return;

      if (!chainRef.current) {
        debugLogger.common.debug('not create webview, 1');
        if (resolve) {
          debugLogger.common.debug('set callback ref, 2');
          chainCallbackRef.current = resolve;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      } else if ((chainRef.current as unknown as any).checkWebViewReady()) {
        debugLogger.common.debug(
          'webview exist, just call resolve function, 3',
        );
        resolve();
      }

      if (!usedNetworksRef.current.includes(networkId)) {
        const newUsedNetwroks = [...usedNetworksRef.current, networkId];
        setUsedNetworks(newUsedNetwroks);
        usedNetworksRef.current = newUsedNetwroks;
      }
    };

    appUIEventBus.on(AppUIEventBusNames.EnsureChainWebEmbed, onCheckWebView);
    return () => {
      appUIEventBus.off(AppUIEventBusNames.EnsureChainWebEmbed, onCheckWebView);
    };
  }, [webEmbedMap]);

  useEffect(() => {
    const onCloseChainWebEmbed = (networkId: string) => {
      if (!networkId) {
        Object.keys(webEmbedMap).forEach((id) => {
          webEmbedMap[id].chainRef.current = null;
          webEmbedMap[id].chainCallbackRef.current = undefined;
        });
        setUsedNetworks([]);
        usedNetworksRef.current = [];
        debugLogger.common.debug(`Destroy All WebView`);
      } else {
        const chain = webEmbedMap[networkId];
        if (chain) {
          chain.chainRef.current = null;
          chain.chainCallbackRef.current = undefined;
          if (usedNetworksRef.current.includes(networkId)) {
            const newUsedNetwroks = usedNetworksRef.current.filter(
              (item) => item !== networkId,
            );
            setUsedNetworks(newUsedNetwroks);
            usedNetworksRef.current = newUsedNetwroks;
          }
          debugLogger.common.debug(`Destroy ${networkId} WebView`);
        }
      }
    };
    appUIEventBus.on(
      AppUIEventBusNames.ChainWebEmbedDisabled,
      onCloseChainWebEmbed,
    );
    return () => {
      appUIEventBus.off(
        AppUIEventBusNames.ChainWebEmbedDisabled,
        onCloseChainWebEmbed,
      );
    };
  }, [webEmbedMap]);

  const content = useMemo(() => {
    debugLogger.common.debug('Parent ChainView Render');

    return (
      <>
        {usedNetworks.map((networkId) => {
          const webEmbed = webEmbedMap[networkId];
          if (webEmbed) {
            const { Component, chainRef, webviewCallback } =
              webEmbedMap[networkId];
            return (
              <Component
                key={networkId}
                ref={chainRef}
                callback={webviewCallback}
              />
            );
          }
          return null;
        })}
      </>
    );
  }, [usedNetworks, webEmbedMap]);

  return content;
}

export default memo(ChainWebEmbed);
