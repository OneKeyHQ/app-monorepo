import { useEffect, useMemo, useRef, useState } from 'react';

import axios from 'axios';
import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import { Button, Dialog, Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EPrimeTransferStatus,
  usePrimeTransferAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import type { IPrimeParamList } from '@onekeyhq/shared/src/routes/prime';

import { usePrimeTransferExit } from './components/hooks/usePrimeTransferExit';
import { PrimeTransferDirection } from './components/PrimeTransferDirection';
import { PrimeTransferExitPrevent } from './components/PrimeTransferExitPrevent';
import { PrimeTransferHome } from './components/PrimeTransferHome';

export default function PagePrimeTransfer() {
  const intl = useIntl();
  const [primeTransferAtom] = usePrimeTransferAtom();
  const navigation = useAppNavigation();
  const { exitTransferFlow, disableExitPrevention } = usePrimeTransferExit();

  const route = useAppRoute<IPrimeParamList, EPrimePages.PrimeTransfer>();
  const routeParamsCode = route.params?.code;
  const routeParamsServer = route.params?.server;

  const initialCode = routeParamsCode || '';

  const [remotePairingCode, setRemotePairingCode] = useState(initialCode);

  const isInitialCodeSet = useRef(false);
  useEffect(() => {
    if (primeTransferAtom.status === EPrimeTransferStatus.init) {
      if (!isInitialCodeSet.current) {
        isInitialCodeSet.current = true;
        setRemotePairingCode(initialCode);
      } else {
        setRemotePairingCode('');
      }
    }
  }, [primeTransferAtom.status, initialCode]);

  const { result } = usePromiseResult(async () => {
    noop(primeTransferAtom.websocketEndpointUpdatedAt);
    const serverConfig =
      await backgroundApiProxy.simpleDb.primeTransfer.getServerConfig();
    const endpoint =
      await backgroundApiProxy.servicePrimeTransfer.getWebSocketEndpoint();
    // remove last slash
    const endpointWithoutLastSlash = endpoint.replace(/\/+$/, '');
    return {
      endpoint: endpointWithoutLastSlash,
      serverConfig,
    };
  }, [primeTransferAtom.websocketEndpointUpdatedAt]);

  useEffect(() => {
    if (!result?.endpoint) {
      return;
    }
    noop(result.serverConfig?.serverType);
    // TODO show websocket connection status by global atom
    void backgroundApiProxy.servicePrimeTransfer.initWebSocket({
      endpoint: result.endpoint,
    });

    void axios
      .get(`${result.endpoint}/health`)
      .then((res) => {
        console.log('health check', res.data);
      })
      .catch((err) => {
        console.log('health check error', err);
      });

    return () => {
      // Disconnect WebSocket
      void backgroundApiProxy.servicePrimeTransfer.disconnectWebSocket();
    };
  }, [result?.endpoint, result?.serverConfig?.serverType]);

  useEffect(() => {
    if (platformEnv.isExtension) {
      // Start UI layer heartbeat - ping service immediately and then every 5 seconds
      void backgroundApiProxy.servicePrimeTransfer.pingService();
      const heartbeatInterval = setInterval(() => {
        void backgroundApiProxy.servicePrimeTransfer.pingService();
      }, 5000);
      return () => {
        // Clear heartbeat interval
        clearInterval(heartbeatInterval);
      };
    }
  }, []);

  useEffect(() => {
    const fn = (
      data: IAppEventBusPayload[EAppEventBusNames.PrimeTransferForceExit],
    ) => {
      Dialog.show({
        title: data.title,
        description: data.description,
        showCancelButton: false,
      });
      exitTransferFlow();
    };
    appEventBus.on(EAppEventBusNames.PrimeTransferForceExit, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeTransferForceExit, fn);
    };
  }, [exitTransferFlow]);

  const contentView = useMemo(() => {
    // if (!primeTransferAtom.websocketConnected) {
    //   return <PrimeTransferHomeSkeleton />;
    // }
    if (primeTransferAtom.status === EPrimeTransferStatus.init) {
      return (
        <PrimeTransferHome
          remotePairingCode={remotePairingCode}
          setRemotePairingCode={setRemotePairingCode}
          autoConnect={!!routeParamsCode}
          autoConnectCustomServer={routeParamsServer || undefined}
        />
      );
    }
    if (
      primeTransferAtom.status === EPrimeTransferStatus.paired ||
      primeTransferAtom.status === EPrimeTransferStatus.transferring
    ) {
      return (
        <>
          <PrimeTransferDirection remotePairingCode={remotePairingCode} />
        </>
      );
    }
    return <></>;
  }, [
    routeParamsCode,
    routeParamsServer,
    primeTransferAtom.status,
    remotePairingCode,
  ]);

  const debugButtons = useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      return (
        <>
          <Button
            onPress={async () => {
              const data =
                await backgroundApiProxy.servicePrimeTransfer.buildTransferData();
              Dialog.debugMessage({
                debugMessage: data,
              });
            }}
          >
            Get transfer data
          </Button>
          <Button
            onPress={async () => {
              const data =
                await backgroundApiProxy.servicePrimeTransfer.buildTransferData();
              const param: IPrimeParamList[EPrimePages.PrimeTransferPreview] = {
                directionUserInfo: undefined,
                transferData: data,
              };
              navigation.navigate(EPrimePages.PrimeTransferPreview, param);
            }}
          >
            Navigate to preview
          </Button>
          <Button
            onPress={() => {
              disableExitPrevention();
            }}
          >
            Change shouldPreventExit to false
          </Button>
          <Button
            onPress={() => {
              void backgroundApiProxy.servicePrimeTransfer.disconnectWebSocket();
            }}
          >
            Disconnect WebSocket
          </Button>
          <Button
            onPress={async () => {
              const endpoint2 =
                await backgroundApiProxy.servicePrimeTransfer.getWebSocketEndpoint();
              if (!endpoint2) {
                return;
              }
              void backgroundApiProxy.servicePrimeTransfer.initWebSocket({
                endpoint: endpoint2,
              });
            }}
          >
            Init WebSocket
          </Button>
        </>
      );
    }
    return <></>;
  }, [navigation, disableExitPrevention]);

  // const shouldPreventExit =
  //   primeTransferAtom.status === EPrimeTransferStatus.paired ||
  //   primeTransferAtom.status === EPrimeTransferStatus.transferring;

  return (
    <Page scrollEnabled>
      <Page.Body>
        {contentView}
        {debugButtons}
      </Page.Body>
      <PrimeTransferExitPrevent
        shouldPreventRemove={primeTransferAtom.shouldPreventExit}
        // shouldPreventRemove={false}
      />
    </Page>
  );
}
