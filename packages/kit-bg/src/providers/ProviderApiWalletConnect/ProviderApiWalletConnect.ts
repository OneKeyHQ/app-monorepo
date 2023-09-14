/* eslint-disable max-classes-per-file */
// import WalletConnect1 from '@walletconnect/client';
import { getSdkError } from '@walletconnect-v2/utils';
import { debounce, isNil } from 'lodash';

import { ToastManagerType } from '@onekeyhq/components/src/ToastManager';
import unlockUtils from '@onekeyhq/kit/src/components/AppLock/unlockUtils';
import type { OneKeyWalletConnector } from '@onekeyhq/kit/src/components/WalletConnect/OneKeyWalletConnector';
import type { IWalletConnectRequestOptions } from '@onekeyhq/kit/src/components/WalletConnect/types';
import walletConnectUtils from '@onekeyhq/kit/src/components/WalletConnect/utils/walletConnectUtils';
import type {
  IWalletConnectClientEventDestroy,
  IWalletConnectClientEventRpc,
} from '@onekeyhq/kit/src/components/WalletConnect/WalletConnectClient';
import type { ISessionStatusPro } from '@onekeyhq/kit/src/components/WalletConnect/WalletConnectClientForDapp';
import { WalletConnectClientForWallet } from '@onekeyhq/kit/src/components/WalletConnect/WalletConnectClientForWallet';
import {
  backgroundShowToast,
  closeDappConnectionPreloading,
  refreshConnectedSites,
} from '@onekeyhq/kit/src/store/reducers/refresher';
import { wait } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
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
import type { SessionTypes } from '@walletconnect-v2/types';
import type {
  IWeb3Wallet,
  Web3WalletTypes,
} from '@walletconnect-v2/web3wallet';

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
          this.removeConnectedAccounts({ connector });
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
        const id = payload.id as number;
        return this.handleSessionRequest({
          // error,
          networkImpl,
          payload,
          connector,
        })
          .then((result) =>
            connector?.approveRequest({
              id,
              result,
            }),
          )
          .catch((error0: Error) => {
            connector?.rejectRequest({
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
      },
    );
  }

  @backgroundMethod()
  async removeConnectedAccounts(options: IWalletConnectRequestOptions) {
    const isV2 = this.isRequestOptionsV2(options);
    const origin = this.getConnectorOrigin(options);
    const accounts = options?.connector?.accounts ?? [];
    const networkImpl =
      options?.connector?.session?.networkImpl ||
      // @ts-ignore
      options?.connector?.networkImpl ||
      IMPL_EVM;
    if (isV2) {
      // TODO v2 accounts and networkImpl check
    }
    if ((accounts.length || isV2) && origin) {
      this.backgroundApi.serviceDapp.removeConnectedAccounts({
        origin,
        networkImpl,
        addresses: accounts,
      });
    }
    return Promise.resolve();
  }

  @backgroundMethod()
  refreshConnectedSites() {
    this.backgroundApi.dispatch(refreshConnectedSites());
  }

  async getChainIdInteger(options: IWalletConnectRequestOptions) {
    const networkImpl = options?.connector?.session?.networkImpl || IMPL_EVM;
    const prevChainId = options?.connector?.chainId ?? 0;

    let chainId: number | undefined;

    // get current chainId from ProviderApi
    const requestProxy = this.getRequestProxy({ networkImpl });
    chainId = await requestProxy.getChainId(options);

    if (isNil(chainId)) {
      chainId = prevChainId;
    }
    return chainId;
  }

  handleSessionRequest({
    networkImpl,
    payload,
    connector,
    sessionRequest,
  }: {
    networkImpl: string;
    payload: IJsonRpcRequest;
    connector?: OneKeyWalletConnector; // v1
    sessionRequest?: Web3WalletTypes.SessionRequest; // v2
  }) {
    return new Promise((resolve, reject) => {
      let request: Promise<any>;
      const isInteractiveMethod = this.isInteractiveMethod({ payload });
      const doProviderRequest = () => {
        const requestProxy = this.getRequestProxy({ networkImpl });
        request = requestProxy.request(
          {
            connector,
            sessionRequest,
          },
          payload,
        );
        return request
          .then(resolve)
          .catch(reject)
          .finally(() => {
            if (isInteractiveMethod) {
              this.redirectToDapp({
                connector,
                sessionRequest,
              });
            }
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
    });
  }

  override async getSessionStatusToApprove(
    options: IWalletConnectRequestOptions,
  ): Promise<ISessionStatusPro> {
    const { connector, proposal } = options;
    if (!connector && !proposal) {
      throw new Error(
        'getSessionStatusToApprove Error: connector(v1) or proposal(v2) not initialized',
      );
    }
    // TODO move to methods
    let networkImpl = IMPL_EVM;
    if (connector?.session) {
      networkImpl = connector.session.networkImpl;
    }

    // TODO dispatch non-evm not support error message to Preloading modal and return

    // https://docs.walletconnect.com/2.0/specs/clients/sign/namespaces#proposal-namespace
    // TODO v2 multiple chain detect from proposal
    const { dispatch } = this.backgroundApi;
    if (platformEnv.isExtensionUi) {
      dispatch(closeDappConnectionPreloading());
    }

    let result: string[] = [];
    const proxyRequest = this.getRequestProxy({ networkImpl });
    // show Connection approval Modal
    result = await proxyRequest.connect(options);

    const chainId = await this.getChainIdInteger(options);
    // walletConnect approve empty accounts is not allowed
    if (!result || !result.length) {
      throw new Error('WalletConnect Session error: accounts is empty');
    }

    setTimeout(() => {
      dispatch(closeDappConnectionPreloading());
    }, 1000);
    return { chainId, accounts: result, networkImpl };
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

  notifySessionChanged = debounce(
    async () => {
      const { connector } = this;
      // **** v1 notify or disconnect
      if (connector && connector.connected) {
        const prevAccounts = connector.accounts || [];
        const chainId = await this.getChainIdInteger({ connector });
        const { networkImpl } = connector.session;
        let accounts: string[] = [];
        const requestProxy = this.getRequestProxy({ networkImpl });
        accounts = await requestProxy.getAccounts({ connector });

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

      // **** v2 notify or disconnect
      if (this.web3walletV2) {
        const { sessions } = await this.getActiveSessionsV2();
        for (const sessionV2 of sessions) {
          const peerUrl = sessionV2?.peer?.metadata?.url;
          const networkImpl = IMPL_EVM;
          const requestProxy = this.getRequestProxy({ networkImpl });
          const accounts = await requestProxy.getAccounts({
            sessionV2,
          });
          if (accounts && accounts.length) {
            const chainId = await this.getChainIdIntegerV2({
              sessionV2,
              networkImpl,
            });
            if (!isNil(chainId)) {
              const { namespaces } =
                walletConnectUtils.convertToSessionNamespacesV2({
                  sessionStatus: {
                    networkImpl,
                    chainId,
                    accounts,
                  },
                  requiredNamespaces: sessionV2.requiredNamespaces,
                  optionalNamespaces: sessionV2.optionalNamespaces,
                });

              // Do NOT await this method, it may block forever
              this.web3walletV2
                .updateSession({
                  topic: sessionV2.topic,
                  namespaces,
                })
                ?.catch((err) => {
                  console.error(
                    'web3walletV2.updateSession catch ERROR: ',
                    err,
                  );
                });

              // https://docs.walletconnect.com/2.0/web/web3wallet/wallet-usage#emit-session-events
              const eip155ChainId = `eip155:${chainId}`;
              await this.web3walletV2.emitSessionEvent({
                topic: sessionV2.topic,
                event: {
                  name: 'accountsChanged',
                  data: accounts,
                },
                chainId: eip155ChainId,
              });
              await this.web3walletV2.emitSessionEvent({
                topic: sessionV2.topic,
                event: {
                  name: 'chainChanged',
                  // https://docs.walletconnect.com/2.0/web/web3wallet/wallet-usage#emit-session-events
                  // https://github.com/WalletConnect/web-examples/blob/main/wallets/react-wallet-eip155/src/pages/session.tsx#L47
                  // https://github.com/WalletConnect/web-examples/blob/main/wallets/react-web3wallet/src/pages/session.tsx#L54
                  // https://github.com/WalletConnect/WalletConnectFlutterV2/blob/master/README.md?plain=1#L242
                  // https://github.com/WalletConnect/se-sdk/blob/main/src/controllers/engine.ts#L277
                  data: chainId, // accounts or chainId or [chainId] or any string?
                },
                chainId: eip155ChainId,
              });

              console.log(
                `WalletConnect: notify session changed, updateSession done`,
                {
                  eip155ChainId,
                  accounts,
                },
              );
            }
          } else {
            await this.disconnectV2({ sessionV2 });
          }
          console.log(
            `WalletConnect: notify session changed, peerUrl=${peerUrl}`,
          );
        }
      }

      await wait(800);
      this.refreshConnectedSites();
    },
    800,
    {
      leading: false,
      trailing: true,
    },
  );

  // V2 ----------------------------------------------

  async getChainIdIntegerV2({
    sessionV2,
    networkImpl,
  }: {
    sessionV2: SessionTypes.Struct;
    networkImpl: string;
  }) {
    const requestProxy = this.getRequestProxy({ networkImpl });

    if (networkImpl === IMPL_EVM) {
      const chainId = await requestProxy.getChainId({
        sessionV2,
      });
      return chainId;
    }

    throw new Error('getChainIdIntegerV2 ERROR: non-EVM not supported yet');
  }

  @backgroundMethod()
  override async disconnectV2({
    sessionV2,
    topic,
    clearWalletIfEmptySessions = true,
  }: {
    sessionV2?: SessionTypes.Struct;
    topic?: string;
    clearWalletIfEmptySessions?: boolean;
  }) {
    let session = sessionV2;
    const topicToDisconnect = topic || sessionV2?.topic;
    // https://docs.walletconnect.com/2.0/reactnative/web3wallet/wallet-usage#session-disconnect
    if (topicToDisconnect) {
      try {
        await this.clearRequestsCacheV2(
          (item) => item.topic === topicToDisconnect,
        );
        await this.web3walletV2?.disconnectSession({
          topic: topicToDisconnect,
          reason: getSdkError('USER_DISCONNECTED'),
        });
      } catch (error) {
        console.error(error);
      }
      await this.clearHistoryCacheV2(
        (item) => item.topic === topicToDisconnect,
      );
    }

    if (topicToDisconnect && !session) {
      session = await this.getSessionV2ByTopic({ topic: topicToDisconnect });
    }
    if (session) {
      const { pairingTopic } = session;
      const sessionsInSamePairing = (
        await this.getActiveSessionsV2()
      ).sessions.filter((s) => s.pairingTopic === pairingTopic);

      if (!sessionsInSamePairing?.length) {
        try {
          await this.disconnectPairingV2({
            topic: pairingTopic,
          });
        } catch (error) {
          console.error(error);
        }
        await this.clearHistoryCacheV2((item) => item.topic === pairingTopic);
      }

      await this.removeConnectedAccounts({
        sessionV2: session,
      });
    }

    await wait(300);
    const { sessions: sessionsV2 } = await this.getActiveSessionsV2();
    if (!sessionsV2?.length && clearWalletIfEmptySessions) {
      await this.clearAllWalletCacheV2();
    }

    return Promise.resolve();
  }

  handleSessionProposalV2 = async (
    proposal: Web3WalletTypes.SessionProposal,
  ) => {
    try {
      const sessionStatus = await this.getSessionStatusToApprove({
        proposal,
      });
      const { namespaces } = walletConnectUtils.convertToSessionNamespacesV2({
        sessionStatus,
        requiredNamespaces: proposal.params.requiredNamespaces,
        optionalNamespaces: proposal.params.optionalNamespaces,
        onError: (error) => {
          this.backgroundApi.dispatch(
            backgroundShowToast({
              title: error?.message,
              type: ToastManagerType.error,
            }),
          );
        },
      });

      // TODO disconnectSession
      const session = await this.web3walletV2?.approveSession({
        id: proposal.id,
        namespaces,
      });
      // TODO save to DB?
      console.log('WalletConnectV2 session_proposal APPROVE: ', session);

      if (session) {
        // TODO redirectToDapp for V2 handler
        // this.redirectToDapp({ })
      }
    } catch (error) {
      const session = await this.web3walletV2?.rejectSession({
        id: proposal.id,
        reason: getSdkError('USER_REJECTED_METHODS', (error as Error)?.message),
      });
      console.error(
        'WalletConnectV2 session_proposal REJECT: ',
        error,
        session,
      );
      await this.removeConnectedAccounts({ proposal });
    } finally {
      this.refreshConnectedSites();
    }
  };

  handleSessionRequestV2 = async (request: Web3WalletTypes.SessionRequest) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { context, topic, params, id } = request;

    try {
      // chainId:"eip155:1"
      // request.params.chainId
      // request.params.request={method,params}
      console.log('WalletConnectV2 session_request: ', request);

      const networkImpl = IMPL_EVM;
      const sessionV2 = await this.getSessionV2ByTopic({ topic });
      if (!sessionV2) {
        throw new Error(`WalletConnect Session not found. topic=${topic}`);
      }

      const currentChainId = await this.getChainIdIntegerV2({
        sessionV2,
        networkImpl,
      });
      if (isNil(currentChainId)) {
        throw new Error(
          `WalletConnect current chainId not found. networkImpl=${networkImpl}`,
        );
      }
      const { namespace: peerNamespace, chainId: peerChainId } =
        walletConnectUtils.getChainIdFromNamespaceChainV2({
          chain: params?.chainId,
        });
      if (!walletConnectUtils.isEvmNamespaceV2(peerNamespace)) {
        throw new Error(
          `OneKey WalletConnect peer namespace support EVM chain only`,
        );
      }
      if (!peerChainId) {
        throw new Error(
          `WalletConnect peer chainId not found. origin=${context?.verified?.origin}`,
        );
      }
      if (String(currentChainId) !== peerChainId) {
        // TODO backgroundShowToast() if isInteractiveMethod
        //      show Error message Modal on Ext
        // formatMessage:   msg__mismatched_networks
        throw new Error(
          `Calling [${params?.request?.method}] ERROR:  Mismatched networks. Please switch OneKey Wallet current network to chainId=${peerChainId}`,
        );
      }

      // TODO sessionV2 accounts and peer accounts matched check

      // handleSessionRequest will call this.redirectToDapp()
      const result = await this.handleSessionRequest({
        networkImpl,
        payload: params.request,
        sessionRequest: request,
      });

      this.resolveSessionRequestV2({ request, result });
    } catch (error: any) {
      this.rejectSessionRequestV2({ request, error });
      debugLogger.walletConnect.error(
        'walletConnectV2.responseCallRequest ERROR',
        error,
      );
      throw error;
    }
  };

  resolveSessionRequestV2({
    request,
    result,
  }: {
    request: Web3WalletTypes.SessionRequest;
    result: any;
  }) {
    const { topic, id } = request;
    const response = { id, jsonrpc: '2.0', result };
    return this.web3walletV2?.respondSessionRequest({ topic, response });
  }

  override rejectSessionRequestV2({
    request,
    error,
  }: {
    request: Web3WalletTypes.SessionRequest;
    error: Error;
  }) {
    const { topic, id } = request;
    const response = {
      id,
      jsonrpc: '2.0',
      error: getSdkError('USER_REJECTED', error?.message),
    };
    return this.web3walletV2?.respondSessionRequest({ topic, response });
  }

  handleSessionDeleteV2 = async ({
    id,
    topic,
    ...others
  }: {
    id: number;
    topic: string;
  }) => {
    console.log('WalletConnectV2 session_delete: ', { id, topic, others });
    try {
      // TODO ERROR: No matching key. session or pairing topic doesn't exist:
      // TODO unable get dapp origin, so we can't remove it from connected sites
      await this.disconnectV2({
        topic,
      });
    } finally {
      // noop
      this.refreshConnectedSites();
    }
  };

  override unregisterEventsV2(web3walletV2: IWeb3Wallet) {
    web3walletV2.off('session_proposal', this.handleSessionProposalV2);
    // console.log('web3walletV2 >>>>> ', web3walletV2);
    // type Event = "session_proposal" | "session_request" | "session_delete" | "auth_request";
    web3walletV2.off('session_request', this.handleSessionRequestV2);
    web3walletV2.off(
      'session_delete', // delete event emit from dapp
      this.handleSessionDeleteV2,
    );
  }

  override registerEventsV2(web3walletV2: IWeb3Wallet) {
    web3walletV2.on('session_proposal', this.handleSessionProposalV2);
    // console.log('web3walletV2 >>>>> ', web3walletV2);
    // type Event = "session_proposal" | "session_request" | "session_delete" | "auth_request";
    web3walletV2.on('session_request', this.handleSessionRequestV2);
    web3walletV2.on(
      'session_delete', // delete event emit from dapp
      this.handleSessionDeleteV2,
    );

    setTimeout(() => {
      this.refreshConnectedSites();
    }, 3000);
  }

  @backgroundMethod()
  async checkWssConnectionStatusV2() {
    const connected = this.web3walletV2?.core?.relayer?.connected;
    // await this.web3walletV2?.engine?.signClient?.ping({ topic: '1111' });
    return Promise.resolve({
      connected,
    });
  }
}

export default ProviderApiWalletConnect;
