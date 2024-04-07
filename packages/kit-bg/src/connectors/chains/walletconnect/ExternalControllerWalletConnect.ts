/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import type {
  IExternalConnectResultWalletConnect,
  IExternalConnectWalletResult,
  IExternalConnectionInfo,
  IExternalCreateConnectorResult,
  IExternalListWalletsResult,
} from '@onekeyhq/shared/types/externalWallet.types';

import { ExternalControllerBase } from '../../base/ExternalControllerBase';
import evmConnectorUtils from '../evm/evmConnectorUtils';

import { ExternalConnectorWalletConnect } from './ExternalConnectorWalletConnect';

import type { IDBExternalAccount } from '../../../dbs/local/types';
import type {
  ISignMessageParams,
  ISignTransactionParams,
} from '../../../vaults/types';

export class ExternalControllerWalletConnect extends ExternalControllerBase {
  override listWallets(): Promise<IExternalListWalletsResult> {
    throw new Error('Method not implemented.');
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
    const { session } =
      (await connector.connect()) as IExternalConnectResultWalletConnect;

    const { addressMap, networkIds } =
      await this.backgroundApi.serviceWalletConnect.parseWalletSessionNamespace(
        { namespaces: session.namespaces },
      );

    return {
      connectionInfo: {
        walletConnect: {
          topic: session?.topic,
          peerMeta: session?.peer?.metadata,
        },
      },
      accountInfo: {
        createAtNetwork: undefined,
        impl: '',
        addresses: addressMap,
        networkIds,
      },
      notSupportedNetworkIds: undefined,
    };
  }

  override addEventListeners({
    connector,
    accountId,
  }: {
    connector: ExternalConnectorWalletConnect;
    accountId: string;
  }): void {
    // events are handled by the WalletConnectDappSide getSharedClient()
  }

  override removeEventListeners({
    connector,
    accountId,
  }: {
    connector: ExternalConnectorWalletConnect;
    accountId: string;
  }): void {
    // events are handled by the WalletConnectDappSide getSharedClient()
  }

  async getWcChain({ networkId }: { networkId: string }): Promise<string> {
    return this.backgroundApi.serviceWalletConnect.getWcChainByNetworkId({
      networkId,
    });
  }

  override async sendTransaction({
    account,
    networkId,
    params,
    connector,
  }: {
    account: IDBExternalAccount;
    networkId: string;
    params: ISignTransactionParams;
    connector: ExternalConnectorWalletConnect;
  }): Promise<ISignedTxPro> {
    const wcChain = await this.getWcChain({ networkId });
    const { method, callParams } = evmConnectorUtils.parseSendTransactionParams(
      {
        params,
      },
    );
    const provider = await connector.getProvider();
    const txid = (await provider.request(
      {
        method,
        params: callParams,
      },
      wcChain,
    )) as string;

    if (!txid) {
      throw new Error(
        'ExternalWalletControllerWalletConnect sendTransaction ERROR: txid not found',
      );
    }

    return {
      txid,
      rawTx: '',
      encodedTx: params.unsignedTx.encodedTx,
    };
  }

  override async signMessage({
    account,
    networkId,
    params,
    connector,
  }: {
    account: IDBExternalAccount;
    networkId: string;
    params: ISignMessageParams;
    connector: ExternalConnectorWalletConnect;
  }): Promise<ISignedMessagePro> {
    const wcChain = await this.getWcChain({ networkId });
    const { method, callParams } = evmConnectorUtils.parseSignMessageParams({
      params,
    });
    const provider = await connector.getProvider();
    const result = (await provider.request(
      {
        method,
        params: callParams,
      },
      wcChain,
    )) as string;

    return [result];
  }
}
