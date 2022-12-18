/* eslint-disable max-classes-per-file */
// import WalletConnect1 from '@walletconnect/client';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { debounce } from 'lodash';

import unlockUtils from '@onekeyhq/kit/src/components/AppLock/unlockUtils';
import type { OneKeyWalletConnector } from '@onekeyhq/kit/src/components/WalletConnect/OneKeyWalletConnector';
import type {
  IWalletConnectClientEventDestroy,
  IWalletConnectClientEventRpc,
} from '@onekeyhq/kit/src/components/WalletConnect/WalletConnectClient';
import { WalletConnectClientForWallet } from '@onekeyhq/kit/src/components/WalletConnect/WalletConnectClientForWallet';
import { closeDappConnectionPreloading } from '@onekeyhq/kit/src/store/reducers/refresher';
import { backgroundClass } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  IMPL_ALGO,
  IMPL_APTOS,
  IMPL_EVM,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WalletConnectRequestProxyAlgo } from './WalletConnectRequestProxyAlgo';
import { WalletConnectRequestProxyAptos } from './WalletConnectRequestProxyAptos';
import { WalletConnectRequestProxyEvm } from './WalletConnectRequestProxyEvm';

import type { IBackgroundApi } from '../../IBackgroundApi';
import type { WalletConnectRequestProxy } from './WalletConnectRequestProxy';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import type { ISessionStatus } from '@walletconnect/types';

@backgroundClass()
class ProviderApiWalletConnect extends WalletConnectClientForWallet {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super();
    this.backgroundApi = backgroundApi;
    this.setupEventHandlers();
  }

  requestProxyMap: {
    [networkImpl: string]: WalletConnectRequestProxy;
  } = {
    [IMPL_EVM]: new WalletConnectRequestProxyEvm({
      client: this,
    }),
    [IMPL_APTOS]: new WalletConnectRequestProxyAptos({
      client: this,
    }),
    [IMPL_ALGO]: new WalletConnectRequestProxyAlgo({
      client: this,
    }),
  };

  getRequestProxy({ networkImpl }: { networkImpl: string }) {
    return this.requestProxyMap[networkImpl] || this.requestProxyMap[IMPL_EVM];
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
        const isInteractiveMethod = this.isInteractiveMethod({ payload });
        const doProviderRequest = () => {
          const requestProxy = this.getRequestProxy({ networkImpl });
          request = requestProxy.request(connector, payload);
          return this.responseCallRequest(connector, request, {
            error,
            payload,
            isInteractiveMethod,
          });
        };

        if (isInteractiveMethod) {
          if (platformEnv.isDesktop) {
            setTimeout(() => {
              window.desktopApi.focus();
            });
          }
          if (!platformEnv.isExtension) {
            return unlockUtils.runAfterUnlock(doProviderRequest);
          }
        }

        return doProviderRequest();
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
        networkImpl:
          // @ts-ignore
          connector?.session?.networkImpl || connector?.networkImpl || IMPL_EVM,
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

  async algoRequest<T>(
    connector: OneKeyWalletConnector,
    data: any,
  ): Promise<T> {
    const { algo } = IInjectedProviderNames;
    const resp = await this.backgroundApi.handleProviderMethods<T>({
      scope: algo,
      origin: this.getConnectorOrigin(connector),
      data,
    });
    return Promise.resolve(resp.result as T);
  }

  async getChainIdInteger(connector: OneKeyWalletConnector) {
    const { networkImpl } = connector.session;
    const prevChainId = connector.chainId || 0;

    let chainId: number | undefined;
    const requestProxy = this.getRequestProxy({ networkImpl });

    chainId = await requestProxy.getChainId(connector);

    if (!chainId) {
      chainId = prevChainId;
    }
    return chainId;
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

    const { networkImpl } = connector.session;
    const { dispatch } = this.backgroundApi;
    dispatch(closeDappConnectionPreloading());

    let result: string[] = [];
    const proxyRequest = this.getRequestProxy({ networkImpl });
    result = await proxyRequest.connect(connector);

    const chainId = await this.getChainIdInteger(connector);
    // walletConnect approve empty accounts is not allowed
    if (!result || !result.length) {
      throw new Error('WalletConnect Session error: accounts is empty');
    }
    return { chainId, accounts: result };
  }

  isInteractiveMethod({ payload }: { payload: IJsonRpcRequest }) {
    return Boolean(
      payload.method &&
        [
          'eth_sendTransaction',
          'eth_signTransaction',
          'eth_sign',
          'personal_sign',
          'eth_signTypedData',
          'eth_signTypedData_v1',
          'eth_signTypedData_v3',
          'eth_signTypedData_v4',
        ].includes(payload.method),
    );
  }

  responseCallRequest(
    connector: OneKeyWalletConnector,
    resultPromise: Promise<any>,
    {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      error,
      payload,
      isInteractiveMethod,
    }: {
      error?: Error | null;
      payload: IJsonRpcRequest;
      isInteractiveMethod?: boolean;
    },
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
      })
      .finally(() => {
        if (isInteractiveMethod) {
          this.redirectToDapp({ connector });
        }
      });
  }

  notifySessionChanged = debounce(
    async () => {
      const { connector } = this;
      if (connector && connector.connected) {
        const prevAccounts = connector.accounts || [];
        const chainId = await this.getChainIdInteger(connector);
        const { networkImpl } = connector.session;
        let accounts: string[] = [];
        const requestProxy = this.getRequestProxy({ networkImpl });
        accounts = await requestProxy.getAccounts(connector);

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
    },
    800,
    {
      leading: false,
      trailing: true,
    },
  );
}

export default ProviderApiWalletConnect;
