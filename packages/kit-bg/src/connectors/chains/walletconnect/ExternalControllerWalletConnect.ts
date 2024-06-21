/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
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

import type { IDBExternalAccount } from '../../../dbs/local/types';
import type {
  IExternalHandleWalletConnectEventsParams,
  IExternalSendTransactionByWalletConnectPayload,
  IExternalSendTransactionPayload,
  IExternalSignMessageByWalletConnectPayload,
  IExternalSignMessagePayload,
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

  async checkNetworkOrAddressMatched({
    networkId,
    account,
  }: {
    account: IDBExternalAccount;
    networkId: string;
  }) {
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
    await this.checkNetworkOrAddressMatched({
      networkId,
      account,
    });
    const ctrl = await this.factory.getController({
      networkId,
    });
    // TODO openNativeWalletAppByDeepLink
    return ctrl.sendTransactionByWalletConnect({ ...payload, connector });
  }

  override async signMessage(
    payload: IExternalSignMessagePayload,
  ): Promise<ISignedMessagePro> {
    const { networkId, account } = payload;
    const connector = payload.connector as ExternalConnectorWalletConnect;
    await this.checkNetworkOrAddressMatched({
      networkId,
      account,
    });
    const ctrl = await this.factory.getController({
      networkId,
    });
    // TODO openNativeWalletAppByDeepLink
    return ctrl.signMessageByWalletConnect({ ...payload, connector });
  }
}
