/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type {
  IExternalConnectResultWalletConnect,
  IExternalConnectWalletResult,
  IExternalConnectionInfo,
  IExternalCreateConnectorResult,
  IExternalListWalletsResult,
} from '@onekeyhq/shared/types/externalWallet.types';

import walletConnectStorage from '../../../services/ServiceWalletConnect/walletConnectStorage';
import { ExternalControllerBase } from '../../base/ExternalControllerBase';

import { ExternalConnectorWalletConnect } from './ExternalConnectorWalletConnect';

import type {
  IExternalCheckNetworkOrAddressMatchedPayload,
  IExternalHandleWalletConnectEventsParams,
  IExternalSendTransactionByWalletConnectPayload,
  IExternalSendTransactionPayload,
  IExternalSignMessageByWalletConnectPayload,
  IExternalSignMessagePayload,
  IExternalSyncAccountFromPeerWalletPayload,
} from '../../base/ExternalControllerBase';

export class ExternalControllerWalletConnect extends ExternalControllerBase {
  override listWallets(): Promise<IExternalListWalletsResult> {
    throw new NotImplemented();
  }

  override async createConnector({
    connectionInfo,
  }: {
    connectionInfo: IExternalConnectionInfo;
  }): Promise<IExternalCreateConnectorResult> {
    const connector = new ExternalConnectorWalletConnect({
      backgroundApi: this.backgroundApi,
      connectionInfo,
    });
    return {
      connectionInfo,
      connector,
    };
  }

  override async connectWallet({
    connector,
  }: {
    connector: ExternalConnectorWalletConnect;
  }): Promise<IExternalConnectWalletResult> {
    const { session } = (await connector.connect({
      impl: connector.connectionInfo.walletConnect?.impl,
    })) as IExternalConnectResultWalletConnect;
    const peerWalletName = session?.peer?.metadata?.name;
    const { addressMap, networkIds } =
      await this.backgroundApi.serviceWalletConnect.parseWalletSessionNamespace(
        { namespaces: session.namespaces },
      );

    return {
      connectionInfo: {
        walletConnect: {
          topic: session?.topic,
          peerMeta: session?.peer?.metadata,
          isNewConnection: undefined, // always set undefined after connected
        },
      },
      accountInfo: {
        createAtNetwork: undefined,
        impl: '',
        addresses: addressMap,
        networkIds,
        // name: `${peerWalletName} WalletConnect`,
        // `🛜 ${peerWalletName}`
        name: peerWalletName ? `${peerWalletName}` : '',
      },
      notSupportedNetworkIds: undefined,
    };
  }

  override addEventListeners({
    connector,
    accountId,
  }: {
    connector: ExternalConnectorWalletConnect;
    accountId: string | undefined;
  }): void {
    // events are handled by the WalletConnectDappSide getSharedClient()
  }

  override removeEventListeners({
    connector,
    accountId,
  }: {
    connector: ExternalConnectorWalletConnect;
    accountId: string | undefined;
  }): void {
    // events are handled by the WalletConnectDappSide getSharedClient()
  }

  override async checkNetworkOrAddressMatched({
    networkId,
    account,
  }: IExternalCheckNetworkOrAddressMatchedPayload) {
    const { connectedAddresses, address, connectionInfo } = account;
    const topic = connectionInfo?.walletConnect?.topic;
    const sessions = await walletConnectStorage.dappSideStorage.getSessions();
    if (!sessions.find((item) => item.topic === topic)) {
      // (cleanupInactiveSessions)
      throw new Error(
        appLocale.intl.formatMessage({
          id: ETranslations.feedback_walletconnect_session_discconected,
        }),
      );
    }
    if (!connectedAddresses[networkId]) {
      throw new Error(
        `${appLocale.intl.formatMessage({
          id: ETranslations.feedback_external_wallet_does_not_approve_network,
        })}: ${networkId}`,
      );
    }
    // TODO checksum compare
    if (
      !connectedAddresses[networkId]
        .toLowerCase()
        .includes(address.toLowerCase())
    ) {
      throw new Error(
        `${appLocale.intl.formatMessage({
          id: ETranslations.feedback_external_wallet_doesn_not_approve_address,
        })}: ${networkId} ${address}`,
      );
    }
  }

  override sendTransactionByWalletConnect(
    payload: IExternalSendTransactionByWalletConnectPayload,
  ): Promise<ISignedTxPro> {
    throw new Error('Not available, use ExternalControllerEvm directly');
  }

  override signMessageByWalletConnect(
    payload: IExternalSignMessageByWalletConnectPayload,
  ): Promise<ISignedMessagePro> {
    throw new Error('Not available, use ExternalControllerEvm directly');
  }

  override handleWalletConnectEvents(
    params: IExternalHandleWalletConnectEventsParams,
  ): Promise<void> {
    throw new Error('Not available, use ExternalControllerEvm directly');
  }

  override async sendTransaction(
    payload: IExternalSendTransactionPayload,
  ): Promise<ISignedTxPro> {
    const { networkId, account } = payload;
    const connector = payload.connector as ExternalConnectorWalletConnect;

    // call walletconnect general checkNetworkOrAddressMatched
    await this.checkNetworkOrAddressMatched({
      networkId,
      account,
      connector,
    });
    const ctrl = await this.factory.getController({
      networkId,
    });

    // call chain specified (EVM) checkNetworkOrAddressMatched
    await ctrl.checkNetworkOrAddressMatched({
      networkId,
      account,
      connector,
    });

    // TODO openNativeWalletAppByDeepLink
    return ctrl.sendTransactionByWalletConnect({ ...payload, connector });
  }

  override async signMessage(
    payload: IExternalSignMessagePayload,
  ): Promise<ISignedMessagePro> {
    const { networkId, account } = payload;
    const connector = payload.connector as ExternalConnectorWalletConnect;

    // call walletconnect general checkNetworkOrAddressMatched
    await this.checkNetworkOrAddressMatched({
      networkId,
      account,
      connector,
    });
    const ctrl = await this.factory.getController({
      networkId,
    });

    // call chain specified (EVM) checkNetworkOrAddressMatched
    await ctrl.checkNetworkOrAddressMatched({
      networkId,
      account,
      connector,
    });

    // TODO openNativeWalletAppByDeepLink
    return ctrl.signMessageByWalletConnect({ ...payload, connector });
  }

  override async syncAccountFromPeerWallet(
    payload: IExternalSyncAccountFromPeerWalletPayload,
  ): Promise<void> {
    console.log(
      'walletconnect syncAccountFromPeerWallet skipped, walletconnect support offline events sync',
    );
  }
}
