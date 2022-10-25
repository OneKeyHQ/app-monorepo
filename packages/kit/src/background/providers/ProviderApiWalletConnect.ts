/* eslint-disable max-classes-per-file */
// import WalletConnect1 from '@walletconnect/client';
import {
  IInjectedProviderNames,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import { ISessionStatus } from '@walletconnect/types';

import { IMPL_APTOS, IMPL_EVM } from '@onekeyhq/engine/src/constants';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyWalletConnector } from '../../components/WalletConnect/OneKeyWalletConnector';
import {
  IWalletConnectClientEventDestroy,
  IWalletConnectClientEventRpc,
} from '../../components/WalletConnect/WalletConnectClient';
import { WalletConnectClientForWallet } from '../../components/WalletConnect/WalletConnectClientForWallet';
import { closeDappConnectionPreloading } from '../../store/reducers/refresher';
import { backgroundClass } from '../decorators';

import type { IBackgroundApi } from '../IBackgroundApi';

@backgroundClass()
class ProviderApiWalletConnect extends WalletConnectClientForWallet {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super();
    this.backgroundApi = backgroundApi;
    this.setupEventHandlers();
  }

  backgroundApi: IBackgroundApi;

  setupEventHandlers() {
    this.on(
      this.EVENT_NAMES.destroy,
      ({ connector }: IWalletConnectClientEventDestroy) => {
        if (connector) {
          this.removeConnectedAccounts(connector);
        }
      },
    );
    this.on(
      this.EVENT_NAMES.call_request,
      ({ connector, error, payload }: IWalletConnectClientEventRpc) => {
        if (error || !payload || !connector) {
          return;
        }
        const { networkImpl } = connector.session;
        let request: Promise<any>;
        if (networkImpl === IMPL_APTOS) {
          request = this.aptosRequest(connector, payload);
        } else {
          request = this.ethereumRequest(connector, payload);
        }
        // TODO active and focus desktop window
        return this.responseCallRequest(connector, request, {
          error,
          payload,
        });
      },
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async removeConnectedAccounts(connector: OneKeyWalletConnector) {
    const { accounts } = connector;
    const origin = this.getConnectorOrigin(connector);
    if (accounts.length && origin) {
      this.backgroundApi.serviceDapp.removeConnectedAccounts({
        origin,
        networkImpl: IMPL_EVM,
        addresses: accounts,
      });
    }
  }

  async ethereumRequest<T>(
    connector: OneKeyWalletConnector,
    data: any,
  ): Promise<T> {
    const { ethereum } = IInjectedProviderNames;
    const resp = await this.backgroundApi.handleProviderMethods<T>({
      scope: ethereum,
      origin: this.getConnectorOrigin(connector),
      data,
    });
    return Promise.resolve(resp.result as T);
  }

  async aptosRequest<T>(
    connector: OneKeyWalletConnector,
    data: any,
  ): Promise<T> {
    const { aptos } = IInjectedProviderNames;
    const resp = await this.backgroundApi.handleProviderMethods<T>({
      scope: aptos,
      origin: this.getConnectorOrigin(connector),
      data,
    });
    return Promise.resolve(resp.result as T);
  }

  // TODO Support for more chain
  async getChainIdInteger(connector: OneKeyWalletConnector) {
    const { networkImpl } = connector.session;
    if (networkImpl === IMPL_APTOS) {
      const { chainId }: { chainId: number } = await this.aptosRequest(
        connector,
        { method: 'getChainId' },
      );
      return chainId;
    }

    // EVM
    return parseInt(
      await this.ethereumRequest(connector, { method: 'net_version' }),
      10,
    );
  }

  override async getSessionStatusToApprove(options: {
    connector?: OneKeyWalletConnector;
  }): Promise<ISessionStatus> {
    const { connector } = options;
    if (!connector) {
      throw new Error(
        'getSessionStatusToApprove Error: connector not initialized',
      );
    }

    const { networkImpl } = connector?.session;
    const { dispatch } = this.backgroundApi;
    dispatch(closeDappConnectionPreloading());

    let result: string[] = [];
    if (networkImpl === IMPL_APTOS) {
      const { address } = await this.aptosRequest<{ address: string }>(
        connector,
        { method: 'connect' },
      );
      result = [address];
    } else {
      result = await this.ethereumRequest<string[]>(connector, {
        method: 'eth_requestAccounts',
      });
    }

    const chainId = await this.getChainIdInteger(connector);
    // walletConnect approve empty accounts is not allowed
    if (!result || !result.length) {
      throw new Error('WalletConnect Session error: accounts is empty');
    }
    return { chainId, accounts: result };
  }

  responseCallRequest(
    connector: OneKeyWalletConnector,
    resultPromise: Promise<any>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { error, payload }: { error?: Error | null; payload: IJsonRpcRequest },
  ) {
    const id = payload.id as number;
    return resultPromise
      .then((result) =>
        connector.approveRequest({
          id,
          result,
        }),
      )
      .catch((error0: Error) => {
        connector.rejectRequest({
          id,
          error: error0,
        });
        debugLogger.walletConnect.error(
          'walletConnect.responseCallRequest ERROR',
          error0,
        );
        // TODO throwCrossError
        throw error0;
      });
  }

  async notifySessionChanged() {
    const { connector } = this;
    if (connector && connector.connected) {
      const prevAccounts = connector.accounts || [];
      const chainId = await this.getChainIdInteger(connector);

      let accounts: string[] = [];
      if (connector.session.networkImpl === IMPL_APTOS) {
        const { address } = await this.aptosRequest<{ address: string }>(
          connector,
          { method: 'account' },
        );
        accounts = [address];
      } else {
        accounts = await this.ethereumRequest<string[]>(connector, {
          method: 'eth_accounts',
        });
      }
      // TODO do not disconnect session, but keep prevAccount if wallet active account changed
      if (!accounts || !accounts.length) {
        accounts = prevAccounts;

        // *** ATTENTION ***  wallet-connect does NOT support empty accounts
        // connector.updateSession({
        //   chainId,
        //   accounts: [],
        // });
        // return;
      }
      if (accounts && accounts.length) {
        connector.updateSession({
          chainId,
          accounts,
        });
      } else {
        await this.disconnect();
      }
    }
  }
}

export default ProviderApiWalletConnect;
