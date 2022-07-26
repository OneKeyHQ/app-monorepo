import { useEffect, useMemo, useState } from 'react';

import WalletConnect from '@walletconnect/client';
import { useWalletConnectContext } from '@walletconnect/react-native-dapp';

import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { generateNetworkIdByChainId } from '@onekeyhq/engine/src/managers/network';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

function addConnectorEventHandler(
  connector: WalletConnect,
  name: string,
  handler?: (error: Error | null, payload: any | null) => void,
) {
  const handlerCallback = (...args: any) => {
    console.log(`wc connector event >>>>>: ${name}`, ...args);
    // @ts-ignore
    handler?.(...args);
  };
  connector.on(name, handlerCallback);
  return handlerCallback;
}

export function useConnectExternalByWalletConnect() {
  const { serviceAccount } = backgroundApiProxy;
  const { connectorOriginal: connector } = useWalletConnectContext();
  const [refreshTimestamp, setRefreshTimestamp] = useState(0);

  console.log('connector update 22111 >>>>>> ', connector);
  // @ts-ignore
  window.$wcConnector = connector;

  const isConnected = connector?.connected;

  const buttonProps = useMemo(() => {
    let onPress;
    let text = '';
    if (connector && !isConnected) {
      onPress = async () => {
        // - App: show all external wallets app list
        // - Desktop: show QRCODE
        // peer wallet chainId check, and enable current network or show error
        const status = await connector?.connect();
        // force context connector reload here
        await connector?.connect();
        const { chainId } = status;
        let address = status.accounts?.[0] || '';

        // EVM address should be lowerCase
        address = address.toLowerCase();

        serviceAccount.addExternalAccount({
          impl: IMPL_EVM,
          chainId,
          address,
          name: `External #${`${Date.now()}`.slice(-2)}`,
        });

        /*
        status = {
          'peerId': '1f9c9753-b028-4b4a-81af-c539cd5b738c',
          'peerMeta': {
            'description':
              'Rainbow makes exploring Ethereum fun and accessible 🌈',
            'icons': [
              'https://avatars2.githubusercontent.com/u/48327834?s=200&v=4',
            ],
            'name': '🌈 Rainbow',
            'ssl': true,
            'url': 'https://rainbow.me',
          },
          'chainId': 1,
          'accounts': ['0xA9b4d559A98ff47C83B74522b7986146538cD4dF'],
        };
        */
        console.log('wc connector status >>>> ', status);
      };
      text = 'Connect With...';
    } else {
      onPress = () => connector?.killSession();
      text = 'Disconnect!';
    }
    return { onPress, text };
  }, [connector, isConnected, serviceAccount]);

  useEffect(() => {
    if (!connector || !isConnected) {
      return;
    }
    const h1 = addConnectorEventHandler(connector, 'session_request');
    const h2 = addConnectorEventHandler(
      connector,
      'session_update',
      // TODO make throttle in service
      //    debounce( func, 1000, { leading: false,trailing: true } )
      (_, payload) => {
        // TODO equals check and update
        setRefreshTimestamp(Date.now());
        console.log(
          'session_update >>>>>',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          payload?.params?.[0],
          connector.chainId,
          connector.accounts,
        );
        // TODO updateSession if not equal
        //  $wcConnector.updateSession({chainId:1, accounts: ['0x76f3f64cb3cd19debee51436df630a342b736c24']})
      },
    );
    const h3 = addConnectorEventHandler(connector, 'call_request');
    const h4 = addConnectorEventHandler(connector, 'connect');
    const h5 = addConnectorEventHandler(connector, 'disconnect');
    return () => {
      connector.off('session_request');
      connector.off('session_update');
      connector.off('call_request');
      connector.off('connect');
      connector.off('disconnect');
    };
  }, [connector, isConnected]);

  return {
    ...buttonProps,
    isConnected,
    chainId: connector?.chainId,
    address: (connector?.accounts?.[0] || '').toLowerCase(),
  };
}

/*

await $wcConnector.sendTransaction({
          "from": "0x76f3f64cb3cd19debee51436df630a342b736c24",
          "to": "0xa9b4d559a98ff47c83b74522b7986146538cd4df",
          "data": "0x",
          "value": "0xa3b5840f4000"
        })

await $wcConnector.signPersonalMessage(['0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765', '0x76f3f64cb3cd19debee51436df630a342b736c24', 'Example password'] )

 */
/*

## Rainbow
handshakeId: 1657877089312829
handshakeTopic: "e3eb6536-4a2f-403c-a6b1-366227582a93"
key: "50b305e4569c4ffc1719c3dc1df7b0380eddb3f98f4a45e56595fa29f7f4f7ae"
peerId: "ede6aa20-b030-4f22-b345-ff1dc8596786"

 */
