import React, { FC, useCallback, useEffect, useRef } from 'react';

import { NavigationProp } from '@react-navigation/core';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import {
  WalletService,
  useWalletConnectContext,
} from '@walletconnect/react-native-dapp';
import { ISessionStatus } from '@walletconnect/types';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, useToast } from '@onekeyhq/components';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  isExternalAccount,
  isWatchingAccount,
} from '@onekeyhq/engine/src/engineUtils';
import { OneKeyError } from '@onekeyhq/engine/src/errors';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { IEncodedTx, ISignedTx } from '@onekeyhq/engine/src/vaults/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { ISessionStatusPro } from '../../components/WalletConnect/WalletConnectClientForDapp';
import { useWalletConnectQrcodeModal } from '../../components/WalletConnect/WalletConnectQrcodeModal';
import { useDecodedTx, useInteractWithInfo } from '../../hooks/useDecodedTx';
import { useDisableNavigationAnimation } from '../../hooks/useDisableNavigationAnimation';

import { DecodeTxButtonTest } from './DecodeTxButtonTest';
import { SendRoutes, SendRoutesParams } from './types';

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendAuthentication>;
type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendRoutes.SendAuthentication
>;
type EnableLocalAuthenticationProps = {
  password: string;
};

const walletServiceCache: WalletService | undefined = {
  'id': '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
  'name': 'Rainbow',
  'description':
    'Rainbow is a fun, simple, and secure way to get started with crypto and explore the new world of Ethereum',
  'homepage': 'https://rainbow.me/',
  'chains': ['eip155:1', 'eip155:10', 'eip155:137', 'eip155:42161'],
  'versions': ['1'],
  'app_type': 'wallet',
  'image_id': '6089655c-cb7e-414b-f742-01fdc154be00',
  'image_url': {
    'sm': 'https://registry.walletconnect.org/api/v2/logo/sm/6089655c-cb7e-414b-f742-01fdc154be00',
    'md': 'https://registry.walletconnect.org/api/v2/logo/md/6089655c-cb7e-414b-f742-01fdc154be00',
    'lg': 'https://registry.walletconnect.org/api/v2/logo/lg/6089655c-cb7e-414b-f742-01fdc154be00',
  },
  'app': {
    'browser': '',
    'ios': 'https://apps.apple.com/app/rainbow-ethereum-wallet/id1457119021',
    'android': 'https://play.google.com/store/apps/details?id=me.rainbow',
    'mac': '',
    'windows': '',
    'linux': '',
  },
  'mobile': { 'native': 'rainbow:', 'universal': 'https://rnbwapp.com' },
  'desktop': { 'native': '', 'universal': '' },
  'metadata': {
    'shortName': 'Rainbow',
    'colors': { 'primary': '#001e59', 'secondary': '' },
  },
} as any;

const SendAuth: FC<EnableLocalAuthenticationProps> = ({ password }) => {
  const navigation = useNavigation<NavigationProps>();
  const toast = useToast();
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const submitted = useRef(false);
  const {
    networkId,
    accountId,
    encodedTx,
    onSuccess,
    unsignedMessage,
    payloadInfo,
    backRouteName,
    sourceInfo,
  } = route.params;
  const payload = payloadInfo || route.params.payload;
  const { engine } = backgroundApiProxy;

  const { decodedTx } = useDecodedTx({
    encodedTx,
    payload,
  });
  const interactInfo = useInteractWithInfo({ sourceInfo });
  const { connectToWallet, qrcodeModalElement } = useWalletConnectQrcodeModal();

  const sendTx = useCallback(async (): Promise<ISignedTx> => {
    // TODO external wallet type check
    // WalletConnect send tx (wallet-connect)
    if (encodedTx && isExternalAccount({ accountId })) {
      const { session: savedSession, walletService } =
        await simpleDb.walletConnect.getExternalAccountSession({ accountId });
      // { accounts, chainId, peerId, peerMeta }
      const {
        status: connectorStatus,
        session,
        client,
      } = await connectToWallet({
        session: savedSession,
        walletService,
      });
      client.watchAccountSessionChanged({ accountId });
      if (session) {
        await client.saveAccountSession({
          accountId,
          session,
        });
      }

      const { connector } = client;
      if (!connector) {
        throw new Error('WalletConnect Error: connector not initialized.');
      }
      const currentNetwork = await engine.getNetwork(networkId);
      const currentAccount = await engine.getAccount(accountId, networkId);
      // TODO currentAccount type is external, get currentAccount peerMeta
      // TODO connector.connect();

      const peerChainId = connector.chainId;
      const peerAddress = (connector.accounts?.[0] || '').toLowerCase();

      console.log('check matched >>>>>', {
        chainId: currentNetwork.extraInfo.networkVersion,
        address: currentAccount.address,
        peerChainId,
        peerAddress,
        peerMeta: connector.peerMeta,
      });

      toast.show(
        {
          title: `Confirm Transaction on [${
            session?.peerMeta?.name || 'Wallet App'
          }]`,
        },
        {
          type: 'success',
        },
      );

      console.log('connectorStatus L>>>>> ', connectorStatus);
      // TODO create wc connector, and check peerMeta.url, chainId, accounts matched,

      console.log('rainbow sendTransaction start >>>>>');
      // TODO reject app gesture down close modal
      // TODO injected provider.sendTransaction in Ext
      // TODO invoke app by DeepLinking
      //    nextConnector.on(ConnectorEvents.CALL_REQUEST_SENT
      const txid = await connector.sendTransaction(encodedTx as IEncodedTxEvm);
      console.log('rainbow sendTransaction result >>>>>', txid);
      return {
        txid,
        rawTx: '',
        encodedTx,
      };
    }

    debugLogger.sendTx.info('Authentication sendTx:', route.params);
    // TODO needs wait rpc call finished, close Modal will cause tx send fail
    const result = await backgroundApiProxy.engine.signAndSendEncodedTx({
      password,
      networkId,
      accountId,
      encodedTx,
    });
    debugLogger.sendTx.info(
      'Authentication sendTx DONE:',
      route.params,
      result,
    );
    return result;
  }, [
    accountId,
    connectToWallet,
    encodedTx,
    engine,
    networkId,
    password,
    route.params,
  ]);

  const signMsg = useCallback(async () => {
    // TODO accountId check if equals to unsignedMessage
    const result = await backgroundApiProxy.engine.signMessage({
      password,
      networkId,
      accountId,
      unsignedMessage,
    });
    return result;
  }, [accountId, networkId, password, unsignedMessage]);

  const submit = useCallback(async () => {
    try {
      if (submitted.current) {
        return;
      }
      submitted.current = true;
      let submitEncodedTx: IEncodedTx | undefined = encodedTx;

      // throw new Error('test error');

      let result: any;
      let signedTx: ISignedTx | undefined;
      let signedMsg: string | undefined;
      if (submitEncodedTx) {
        signedTx = await sendTx();
        result = signedTx;
        // encodedTx will be edit by buildUnsignedTx, re-assign encodedTx
        submitEncodedTx = signedTx.encodedTx || submitEncodedTx;
      }
      if (unsignedMessage) {
        signedMsg = await signMsg();
        result = signedMsg;
        console.log('>>>>>>>> unsignedMessage ', unsignedMessage, signedMsg);
      }
      if (result) {
        onSuccess?.(result, {
          signedTx,
          encodedTx: submitEncodedTx,
          // should rebuild decodedTx from encodedTx,
          // as encodedTx will be edit by buildUnsignedTx
          decodedTx: submitEncodedTx
            ? (
                await backgroundApiProxy.engine.decodeTx({
                  networkId,
                  accountId,
                  encodedTx: submitEncodedTx,
                  payload,
                  interactInfo,
                })
              ).decodedTx
            : undefined,
        });
        if (navigation?.canGoBack?.()) {
          // onSuccess will close() modal, goBack() is NOT needed here.
          // navigation.getParent()?.goBack?.();
        }
      }
    } catch (e) {
      console.error(e);
      if (backRouteName) {
        // navigation.navigate(backRouteName);
        navigation.navigate({
          merge: true,
          name: backRouteName,
          // pass empty params, as backRouteName params format may be different
          params: {},
        });
      } else {
        // goBack or close
        navigation.getParent()?.goBack?.();
      }

      // EIP 1559 fail:
      //  replacement transaction underpriced
      //  already known
      setTimeout(() => {
        const error = e as OneKeyError;
        // TODO: better error displaying
        if (
          error?.code === -32603 &&
          typeof error?.data?.message === 'string'
        ) {
          toast.show(
            {
              title:
                error.data.message ||
                intl.formatMessage({ id: 'transaction__failed' }),
              description: error.data.message, // TODO toast description not working
            },
            { type: 'error' },
          );
        } else {
          const msg = error?.key
            ? intl.formatMessage({ id: error?.key as any }, error?.info ?? {})
            : error?.message ?? '';
          toast.show(
            {
              title: msg || intl.formatMessage({ id: 'transaction__failed' }),
              description: msg,
            },
            { type: 'error' },
          );
        }
      }, 600);
    }
  }, [
    accountId,
    backRouteName,
    encodedTx,
    interactInfo,
    intl,
    navigation,
    networkId,
    onSuccess,
    payload,
    sendTx,
    signMsg,
    toast,
    unsignedMessage,
  ]);

  useEffect(() => {
    if (decodedTx || unsignedMessage) {
      submit();
    }
  }, [decodedTx, unsignedMessage, submit]);
  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
      {qrcodeModalElement}
    </Center>
  );
};
const SendAuthMemo = React.memo(SendAuth);

export const HDAccountAuthentication = () => {
  const route = useRoute<RouteProps>();
  const { params } = route;
  const { walletId } = params;

  useDisableNavigationAnimation({
    condition: !!params.autoConfirmAfterFeeSaved,
  });

  // TODO all Modal close should reject dapp call
  return (
    <Modal height="598px" footer={null}>
      <DecodeTxButtonTest encodedTx={params.encodedTx} />
      <Protected walletId={walletId} field={ValidationFields.Payment}>
        {(password) => {
          console.log('SendAuthMemo render >>>>>>>>>>>>>>>>>> ');
          return <SendAuthMemo password={password} />;
        }}
      </Protected>
    </Modal>
  );
};

export default HDAccountAuthentication;
