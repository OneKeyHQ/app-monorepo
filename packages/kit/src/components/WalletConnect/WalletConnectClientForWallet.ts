import { merge } from 'lodash';
import { Linking } from 'react-native';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  IMPL_ALGO,
  IMPL_APTOS,
  IMPL_EVM,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { wait } from '../../utils/helper';
import Minimizer from '../Minimizer';

import { WalletConnectClientBase } from './WalletConnectClient';
import { WALLET_CONNECT_CLIENT_META } from './walletConnectConsts';
import { WalletConnectSessionStorage } from './WalletConnectSessionStorage';

import type { OneKeyWalletConnector } from './OneKeyWalletConnector';
import type { IWalletConnectClientOptions } from './WalletConnectClient';
import type { IClientMeta, ISessionStatus } from '@walletconnect/types';

const sessionStorage = new WalletConnectSessionStorage({
  storageId: WalletConnectSessionStorage.STORAGE_IDS.WALLET_SIDE,
});

const clientMeta: IClientMeta = WALLET_CONNECT_CLIENT_META;

export abstract class WalletConnectClientForWallet extends WalletConnectClientBase {
  override isWalletSide = true;

  constructor(props?: IWalletConnectClientOptions) {
    super(
      merge(
        {
          sessionStorage,
          clientMeta,
        },
        props,
      ),
    );
    (async () => {
      // ** do not disconnect previous session
      // await this.disconnect();

      // ** auto connect previous session
      await this.autoConnectLastSession();
    })();
  }

  abstract getSessionStatusToApprove(options: {
    connector?: OneKeyWalletConnector;
  }): Promise<ISessionStatus>;

  previousUri: string | undefined;

  async redirectToDapp({ connector }: { connector: OneKeyWalletConnector }) {
    const isDeepLink = connector.session?.isDeepLink || connector.isDeepLink;
    debugLogger.walletConnect.info('redirectToDapp', { isDeepLink });
    if (!isDeepLink) {
      return;
    }
    if (!platformEnv.isNative) {
      return;
    }
    // @ts-ignore
    const dappScheme = connector?.peerMeta?.scheme as string | undefined;
    // wait websocket message sent
    await wait(1500);
    if (dappScheme) {
      const fullSchema = `${dappScheme}://`;
      if (await Linking.canOpenURL(fullSchema)) {
        await Linking.openURL(fullSchema);
        return;
      }
    }
    Minimizer?.goBack?.();
  }

  // TODO connecting check, thread lock
  // connectToDapp
  @backgroundMethod()
  async connect({ uri, isDeepLink }: { uri: string; isDeepLink?: boolean }) {
    // eslint-disable-next-line no-param-reassign
    uri = uri?.trim() || uri;
    // uri network param defaults to evm
    const { searchParams } = new URL(uri);

    let network = IMPL_EVM;
    if (
      searchParams.get('network') === IMPL_ALGO ||
      searchParams.get('algorand')
    ) {
      network = IMPL_ALGO;
    }
    if (searchParams.get('network') === IMPL_APTOS) {
      network = IMPL_APTOS;
    }

    if (this.previousUri && this.previousUri === uri) {
      await wait(1500);
      throw new Error('WalletConnect ERROR: uri is expired');
    }
    this.previousUri = uri;

    const connector = await this.createConnector(
      {
        uri,
        networkImpl: network,
      },
      {
        shouldDisconnectStorageSession: true,
        isDeepLink,
      },
    );

    // TODO convert url to origin
    const origin = this.getConnectorOrigin(connector);
    debugLogger.walletConnect.info('new WalletConnect() by uri', {
      origin,
      network,
      uri,
    });

    // TODO on('connect') fired on peerId ready or approveSession()?

    // TODO show loading in UI

    // TODO check dapp is EVM or Solana
    //    connector.session
    //    connector.uri
    try {
      // call ProviderApiEthereum.eth_requestAccounts method
      //    serviceDapp.openConnectionModal
      //    _openModalByRouteParams
      //    extUtils.openStandaloneWindow
      const sessionStatus = await this.getSessionStatusToApprove({
        connector,
      });
      if (connector.connected) {
        debugLogger.walletConnect.info(
          'walletConnect.connect -> updateSession',
          sessionStatus,
        );
        connector.updateSession(sessionStatus);
      } else {
        const doApproveSession = () => {
          debugLogger.walletConnect.info(
            'walletConnect.connect -> approveSession',
            sessionStatus,
          );
          connector.approveSession(sessionStatus);
        };
        doApproveSession();
        // setTimeout(doApproveSession, 2000);// throw error if connected already
      }
      this.redirectToDapp({ connector });
    } catch (error) {
      debugLogger.walletConnect.info(
        'walletConnect.connect -> rejectSession',
        error,
      );
      connector.rejectSession(error as any);
    } finally {
      await wait(600);
    }
  }
}
