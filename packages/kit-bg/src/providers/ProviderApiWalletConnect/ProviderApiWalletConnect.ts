import { getSdkError } from '@walletconnect/utils';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  IMPL_ALGO,
  IMPL_COSMOS,
  IMPL_EVM,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EDAppConnectionModal,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import { EWalletConnectSessionEvents } from '@onekeyhq/shared/src/walletConnect/types';
import type { IWalletConnectSessionProposalResult } from '@onekeyhq/shared/types/dappConnection';

import { travelModeDappRequestIngress } from '../../apis/TravelModeDappRequestIngress';
import walletConnectClient from '../../services/ServiceWalletConnect/walletConnectClient';
import { walletConnectDiagnostics } from '../../services/ServiceWalletConnect/WalletConnectDiagnostics';

import { WalletConnectRequestProxyAlgo } from './WalletConnectRequestProxyAlgo';
import { WalletConnectRequestProxyCosmos } from './WalletConnectRequestProxyCosmos';
import { WalletConnectRequestProxyEth } from './WalletConnectRequestProxyEth';

import type {
  IWalletConnectRequestOptions,
  WalletConnectRequestProxy,
} from './WalletConnectRequestProxy';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IWalletKit, WalletKitTypes } from '@reown/walletkit';

class ProviderApiWalletConnect {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  web3Wallet?: IWalletKit;

  private initializing?: Promise<void>;

  requestProxyMap: {
    [networkImpl: string]: WalletConnectRequestProxy;
  } = {
    [IMPL_EVM]: new WalletConnectRequestProxyEth({
      client: this,
    }),
    [IMPL_ALGO]: new WalletConnectRequestProxyAlgo({
      client: this,
    }),
    [IMPL_COSMOS]: new WalletConnectRequestProxyCosmos({
      client: this,
    }),
  };

  getRequestProxy({ networkImpl }: { networkImpl: string }) {
    return this.requestProxyMap[networkImpl];
  }

  async initializeOnStart(): Promise<void> {
    walletConnectDiagnostics.record('connection', 'restoring_sessions');
    try {
      const sessionsNew =
        await walletConnectClient.getWalletSideStorageSessions();
      // const sessions = await walletConnectStorage.walletSideStorage.getSessions();
      if (sessionsNew?.length) {
        await this.initialize();
      } else {
        walletConnectDiagnostics.record('connection', 'no_stored_sessions');
      }
    } catch (error) {
      walletConnectDiagnostics.setInitialization('failed', error);
      throw error;
    }
  }

  @backgroundMethod()
  async initialize() {
    if (this.web3Wallet) {
      return;
    }
    if (!this.initializing) {
      this.initializing = (async () => {
        walletConnectDiagnostics.setInitialization('initializing');
        try {
          this.web3Wallet = await walletConnectClient.getWalletSideClient();
          this.registerEvents();
          walletConnectDiagnostics.setInitialization('ready');
        } catch (error) {
          walletConnectDiagnostics.setInitialization('failed', error);
          throw error;
        }
      })().finally(() => {
        this.initializing = undefined;
      });
    }
    await this.initializing;
  }

  registerEvents() {
    if (!this.web3Wallet) {
      throw new OneKeyLocalError('web3Wallet is not initialized');
    }
    this.web3Wallet.on(
      EWalletConnectSessionEvents.session_proposal,
      this.gatedHandleSessionProposal,
    );
    this.web3Wallet.on(
      EWalletConnectSessionEvents.session_request,
      this.gatedHandleSessionRequest,
    );
    this.web3Wallet.on(
      EWalletConnectSessionEvents.session_delete,
      this.gatedHandleSessionDelete,
    );
    this.web3Wallet.engine.signClient.events.on(
      EWalletConnectSessionEvents.session_ping,
      this.gatedHandleSessionPing,
    );
    this.web3Wallet.on(
      EWalletConnectSessionEvents.session_authenticate,
      this.gatedHandleAuthRequest,
    );
    walletConnectDiagnostics.setListenersRegistered(true);
    // this.web3Wallet.on(
    //   EWalletConnectSessionEvents.session_connect,
    //   function () {
    //     // eslint-disable-next-line prefer-rest-params
    //     console.log('session_connect: ', arguments);
    //     debugger;
    //   },
    // );
  }

  unregisterEvents() {
    if (!this.web3Wallet) {
      throw new OneKeyLocalError('web3Wallet is not initialized');
    }
    this.web3Wallet.off(
      EWalletConnectSessionEvents.session_proposal,
      this.gatedHandleSessionProposal,
    );
    this.web3Wallet.off(
      EWalletConnectSessionEvents.session_request,
      this.gatedHandleSessionRequest,
    );
    this.web3Wallet.off(
      EWalletConnectSessionEvents.session_delete,
      this.gatedHandleSessionDelete,
    );
    this.web3Wallet.engine.signClient.events.off(
      EWalletConnectSessionEvents.session_ping,
      this.gatedHandleSessionPing,
    );
    this.web3Wallet.off(
      EWalletConnectSessionEvents.session_authenticate,
      this.gatedHandleAuthRequest,
    );
    walletConnectDiagnostics.setListenersRegistered(false);
  }

  private handleSessionProposal = async (
    proposal: WalletKitTypes.SessionProposal,
  ) => {
    const { serviceWalletConnect, serviceDApp } = this.backgroundApi;
    console.log('onSessionProposal: ', JSON.stringify(proposal));
    const optionalNamespaces = proposal?.params?.optionalNamespaces;
    const optionalNamespacesString = Object.keys(optionalNamespaces).join(', ');
    // check if all required networks are supported
    const notSupportedChains = await serviceWalletConnect.getNotSupportedChains(
      // proposal,
      proposal?.params?.requiredNamespaces,
    );
    const origin = uriUtils.safeGetWalletConnectOrigin(proposal);

    const metadata = proposal.params.proposer.metadata;
    if (notSupportedChains.length > 0) {
      console.error(
        'ProviderApiWalletConnect ERROR: onSessionProposal notSupportedChains',
        notSupportedChains,
      );
      await this.rejectSession({
        id: proposal.id,
        reason: getSdkError('UNSUPPORTED_CHAINS'),
      });
      void this.backgroundApi.serviceApp.showToast({
        method: 'error',
        title: `ChainId: ${notSupportedChains[0]}`,
        message: 'Unsupported yet',
      });
      defaultLogger.discovery.dapp.dappUse({
        dappName: metadata.name,
        dappDomain: metadata.url,
        action: 'ConnectWallet',
        network: optionalNamespacesString,
        failReason: `Unsupported ChainId: ${notSupportedChains[0]}`,
      });
      return;
    }

    try {
      if (!origin) {
        const message = appLocale.intl.formatMessage({
          id: ETranslations.browser_invalid_url,
        });
        await this.rejectSession({
          id: proposal.id,
          reason: {
            message,
            code: 40_001,
          },
        });
        void this.backgroundApi.serviceApp.showToast({
          method: 'error',
          title: message,
        });
        defaultLogger.discovery.dapp.dappUse({
          dappName: metadata.name,
          dappDomain: metadata.url,
          action: 'ConnectWallet',
          network: optionalNamespacesString,
          failReason: message,
        });
        return;
      }

      walletConnectDiagnostics.record(
        'session',
        'proposal_awaiting_approval',
        proposal,
      );
      const result = (await serviceDApp.openModal({
        request: {
          scope: '$walletConnect',
          origin,
        },
        screens: [
          EModalRoutes.DAppConnectionModal,
          EDAppConnectionModal.WalletConnectSessionProposalModal,
        ],
        params: {
          proposal,
        },
        fullScreen: true,
      })) as IWalletConnectSessionProposalResult;
      walletConnectDiagnostics.record(
        'session',
        'proposal_approving',
        proposal,
      );
      const newSession = await this.web3Wallet?.approveSession({
        id: proposal.id,
        namespaces: result.supportedNamespaces,
      });
      walletConnectDiagnostics.record('session', 'proposal_approved', proposal);
      await serviceDApp.saveConnectionSession({
        origin,
        accountsInfo: result.accountsInfo,
        storageType: 'walletConnect',
        walletConnectTopic: newSession?.topic,
      });
      void serviceWalletConnect.batchEmitNetworkChangedEvent({
        topic: newSession?.topic ?? '',
        accountsInfo: result.accountsInfo,
      });
      defaultLogger.discovery.dapp.dappUse({
        dappName: metadata.name,
        dappDomain: metadata.url,
        action: 'ConnectWallet',
        network: optionalNamespacesString,
      });
    } catch (e) {
      walletConnectDiagnostics.record(
        'session',
        'proposal_failed',
        proposal,
        e,
      );
      console.error('onSessionProposal error: ', e);
      await this.rejectSession({
        id: proposal.id,
        reason: getSdkError('USER_REJECTED'),
      });
      defaultLogger.discovery.dapp.dappUse({
        dappName: metadata.name,
        dappDomain: metadata.url,
        action: 'ConnectWallet',
        network: optionalNamespacesString,
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        failReason: `${e?.message ?? e}`,
      });
    }
  };

  private handleSessionRequest = async (
    request: WalletKitTypes.SessionRequest,
  ) => {
    const { topic, id } = request;
    console.log('onSessionRequest: ', request);
    const { serviceWalletConnect } = this.backgroundApi;

    walletConnectDiagnostics.record(
      'request',
      'validating_chain_and_method',
      request,
    );
    // check request method is supported
    const chain = await serviceWalletConnect.getWcChainInfo(
      request.params.chainId,
    );
    if (!chain) {
      walletConnectDiagnostics.record(
        'request',
        'unsupported_chain',
        request,
        getSdkError('UNSUPPORTED_CHAINS'),
      );
      await this.respondSessionRequest({
        topic,
        response: {
          id,
          jsonrpc: '2.0',
          error: getSdkError('UNSUPPORTED_CHAINS'),
        },
      });
      void this.backgroundApi.serviceApp.showToast({
        method: 'error',
        title: `ChainId: ${request.params.chainId}`,
        message: 'Unsupported yet',
      });
      return;
    }

    if (
      !(await serviceWalletConnect.checkMethodSupport(
        chain.wcNamespace,
        request.params.request.method,
      ))
    ) {
      walletConnectDiagnostics.record(
        'request',
        'unsupported_method',
        request,
        getSdkError('UNSUPPORTED_METHODS'),
      );
      await this.respondSessionRequest({
        topic,
        response: {
          id,
          jsonrpc: '2.0',
          error: getSdkError('UNSUPPORTED_METHODS'),
        },
      });
      return;
    }

    let response: Parameters<
      IWalletKit['respondSessionRequest']
    >[0]['response'];
    try {
      const networkImpl = await serviceWalletConnect.getNetworkImplByNamespace(
        chain.wcNamespace,
      );
      const requestProxy = this.getRequestProxy({ networkImpl });

      // If the requested chainId does not match the one stored locally, switch the network.
      walletConnectDiagnostics.record('request', 'switching_network', request);
      await this.switchNetwork({
        request,
        requestProxy,
      });
      walletConnectDiagnostics.record('request', 'dispatching_method', request);
      const ret = await requestProxy.request(
        { sessionRequest: request, wcChain: chain.wcChain },
        request.params.request,
      );
      walletConnectDiagnostics.record('request', 'method_completed', request);
      console.log('====>onSessionRequest ret: ', ret);

      response = { id, jsonrpc: '2.0', result: ret };
    } catch (error) {
      walletConnectDiagnostics.record(
        'request',
        'request_failed',
        request,
        error,
      );
      response = {
        id,
        jsonrpc: '2.0',
        error: getSdkError('USER_REJECTED', (error as Error)?.message),
      };
    }
    // A transport failure cannot change the outcome of an executed request.
    await this.respondSessionRequest({ topic, response });
  };

  private handleSessionDelete = async (args: WalletKitTypes.SessionDelete) => {
    console.log('onSessionDelete: ', args);
    console.log(this.web3Wallet?.getActiveSessions());
    await this.backgroundApi.serviceWalletConnect.handleSessionDelete(
      args.topic,
    );
  };

  private handleAuthRequest = async (
    args: WalletKitTypes.SessionAuthenticate,
  ) => {
    walletConnectDiagnostics.record(
      'request',
      'authentication_handler_not_implemented',
      args,
    );
    console.log('onAuthRequest: ', args);
  };

  private handleSessionPing = async () => {
    console.log('ping');
  };

  private async respondSessionRequest(
    params: Parameters<IWalletKit['respondSessionRequest']>[0],
  ) {
    const payload = { topic: params.topic, id: params.response.id };
    const responseError =
      'error' in params.response ? params.response.error : undefined;
    walletConnectDiagnostics.record(
      'request',
      responseError ? 'sending_error_response' : 'sending_response',
      payload,
      responseError,
    );
    try {
      await this.web3Wallet?.respondSessionRequest(params);
      walletConnectDiagnostics.record('request', 'response_submitted', payload);
    } catch (error) {
      walletConnectDiagnostics.record(
        'request',
        'response_failed',
        payload,
        error,
      );
      throw error;
    }
  }

  private async rejectSession(
    params: Parameters<IWalletKit['rejectSession']>[0],
  ) {
    walletConnectDiagnostics.record(
      'session',
      'proposal_rejecting',
      params,
      params.reason,
    );
    try {
      await this.web3Wallet?.rejectSession(params);
      walletConnectDiagnostics.record('session', 'proposal_rejected', params);
    } catch (error) {
      walletConnectDiagnostics.record(
        'session',
        'proposal_rejection_failed',
        params,
        error,
      );
      throw error;
    }
  }

  private gateSessionEvent<TArgs extends unknown[]>(
    event: EWalletConnectSessionEvents,
    operation: (...args: TArgs) => Promise<void>,
  ) {
    const gatedOperation = travelModeDappRequestIngress.wrap({
      operation: async (...args: TArgs) => {
        walletConnectDiagnostics.record(
          'session',
          `${event}_handling`,
          args[0],
        );
        try {
          await operation(...args);
        } catch (error) {
          walletConnectDiagnostics.record(
            'session',
            `${event}_failed`,
            args[0],
            error,
          );
          throw error;
        }
      },
      // Suppressed sessions must not start another outbound response.
      onBlocked: async (...args: TArgs) => {
        walletConnectDiagnostics.record(
          'session',
          `${event}_blocked_by_travel_mode`,
          args[0],
        );
      },
    });
    return (...args: TArgs) => {
      walletConnectDiagnostics.receivedSessionEvent(event, args[0]);
      return gatedOperation(...args);
    };
  }

  private gatedHandleSessionProposal = this.gateSessionEvent(
    EWalletConnectSessionEvents.session_proposal,
    this.handleSessionProposal,
  );

  private gatedHandleSessionRequest = this.gateSessionEvent(
    EWalletConnectSessionEvents.session_request,
    this.handleSessionRequest,
  );

  private gatedHandleSessionDelete = this.gateSessionEvent(
    EWalletConnectSessionEvents.session_delete,
    this.handleSessionDelete,
  );

  private gatedHandleSessionPing = this.gateSessionEvent(
    EWalletConnectSessionEvents.session_ping,
    this.handleSessionPing,
  );

  private gatedHandleAuthRequest = this.gateSessionEvent(
    EWalletConnectSessionEvents.session_authenticate,
    this.handleAuthRequest,
  );

  @backgroundMethod()
  async switchNetwork({
    request,
    requestProxy,
  }: {
    request: WalletKitTypes.SessionRequest;
    requestProxy: WalletConnectRequestProxy;
  }) {
    const origin = this.getDAppOrigin({ sessionRequest: request });
    // Find connected account
    const accountsInfo =
      await this.backgroundApi.serviceDApp.getConnectedAccounts({
        origin,
        scope: requestProxy.providerName,
        isWalletConnectRequest: true,
      });
    const chainInfo =
      await this.backgroundApi.serviceWalletConnect.getWcChainInfo(
        request.params.chainId,
      );
    if (!accountsInfo?.[0]?.accountInfo.networkId || !chainInfo?.networkId) {
      // The request handler owns the response and must not dispatch the method.
      throw new OneKeyLocalError('No connected account');
    }
    if (accountsInfo[0].accountInfo.networkId === chainInfo.networkId) {
      return;
    }
    await this.backgroundApi.serviceDApp.switchConnectedNetwork({
      newNetworkId: chainInfo.networkId,
      oldNetworkId: accountsInfo[0].accountInfo.networkId,
      origin,
      scope: requestProxy.providerName,
      isWalletConnectRequest: true,
    });
  }

  @backgroundMethod()
  async connectToDapp(uri: string) {
    await this.initialize();
    if (!this.web3Wallet) {
      throw new OneKeyLocalError('web3Wallet is not initialized');
    }
    walletConnectDiagnostics.record('session', 'pairing_started');
    try {
      await this.web3Wallet.pair({ uri });
      walletConnectDiagnostics.record('session', 'pairing_submitted');
    } catch (error) {
      walletConnectDiagnostics.record(
        'session',
        'pairing_failed',
        undefined,
        error,
      );
      throw error;
    }
  }

  getDAppOrigin(option: IWalletConnectRequestOptions) {
    const originUrl =
      option.sessionRequest?.verifyContext.verified.origin ?? '';
    try {
      return new URL(originUrl).origin;
    } catch (_error) {
      return originUrl;
    }
  }
}

export default ProviderApiWalletConnect;
