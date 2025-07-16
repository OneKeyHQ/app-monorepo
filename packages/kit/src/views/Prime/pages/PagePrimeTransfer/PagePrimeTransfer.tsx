import { useEffect, useMemo, useState } from 'react';

import axios from 'axios';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Page,
  SizableText,
  Spinner,
  Toast,
  YStack,
} from '@onekeyhq/components';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EPrimeTransferStatus,
  usePrimeTransferAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPrimeParamList } from '@onekeyhq/shared/src/routes/prime';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import { PrimeTransferDirection } from './components/PrimeTransferDirection';
import { PrimeTransferHome } from './components/PrimeTransferHome';

export default function PagePrimeTransfer() {
  const intl = useIntl();
  const [primeTransferAtom] = usePrimeTransferAtom();
  const navigation = useAppNavigation();

  const [remotePairingCode, setRemotePairingCode] = useState('');

  useEffect(() => {
    if (primeTransferAtom.status === EPrimeTransferStatus.init) {
      setRemotePairingCode('');
    }
  }, [primeTransferAtom.status]);

  // const [endpoint] = useState(
  //   platformEnv.isNative
  //     ? 'http://192.168.31.246:3868'
  //     : 'http://192.168.31.246:3868',
  // );
  const endpoint = 'https://app-monorepo.onrender.com';

  console.log('endpoint', endpoint);

  useEffect(() => {
    // TODO show websocket connection status by global atom
    void backgroundApiProxy.servicePrimeTransfer.initWebSocket({
      endpoint,
    });

    void axios
      .get(`${endpoint}/health`)
      .then((res) => {
        console.log('health check', res.data);
      })
      .catch((err) => {
        console.log('health check error', err);
      });

    return () => {
      void backgroundApiProxy.servicePrimeTransfer.disconnectWebSocket();
    };
  }, [endpoint]);

  useEffect(() => {
    const fn = (
      data: IAppEventBusPayload[EAppEventBusNames.PrimeTransferForceExit],
    ) => {
      Dialog.show({
        title: data.title,
        description: data.description,
      });
      navigation.popStack();
    };
    appEventBus.on(EAppEventBusNames.PrimeTransferForceExit, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeTransferForceExit, fn);
    };
  }, [navigation]);

  const contentView = useMemo(() => {
    if (!primeTransferAtom.websocketConnected) {
      return <Spinner size="large" />;
    }
    if (primeTransferAtom.status === EPrimeTransferStatus.init) {
      return (
        <PrimeTransferHome
          remotePairingCode={remotePairingCode}
          setRemotePairingCode={setRemotePairingCode}
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
    primeTransferAtom.websocketConnected,
    primeTransferAtom.status,
    remotePairingCode,
    setRemotePairingCode,
  ]);

  const debugButtons = useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      return (
        <>
          <Button
            onPress={async () => {
              const data =
                await backgroundApiProxy.servicePrimeTransfer.getDataForTransfer();
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
                await backgroundApiProxy.servicePrimeTransfer.getDataForTransfer();
              const param: IPrimeParamList[EPrimePages.PrimeTransferPreview] = {
                directionUserInfo: undefined,
                transferData: data,
              };
              navigation.navigate(EPrimePages.PrimeTransferPreview, param);
            }}
          >
            Navigate to preview
          </Button>
        </>
      );
    }
    return <></>;
  }, [navigation]);

  return (
    <Page scrollEnabled>
      <Page.Body>
        {contentView}
        {debugButtons}
      </Page.Body>
    </Page>
  );
}
