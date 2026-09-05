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

import walletConnectClient from '../../services/ServiceWalletConnect/walletConnectClient';

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

  async initializeOnStart() {
    const sessionsNew =
      await walletConnectClient.getWalletSideStorageSessions();
    // const sessions = await walletConnectStorage.walletSideStorage.getSessions();
    if (sessionsNew?.length) {
      await this.initialize();
    }
  }

  @backgroundMethod()
  async initialize() {
    if (this.web3Wallet) {
      return;
    }
    this.web3Wallet = await walletConnectClient.getWalletSideClient();
    this.registerEvents();
  }

  registerEvents() {
    if (!this.web3Wallet) {
      throw new OneKeyLocalError('web3Wallet is not initialized');
    }
    this.web3Wallet.on(
      EWalletConnectSessionEvents.session_proposal,
      this.onSessionProposal,
    );
    this.web3Wallet.on(
      EWalletConnectSessionEvents.session_request,
      this.onSessionRequest,
    );
    this.web3Wallet.on(
      EWalletConnectSessionEvents.session_delete,
      this.onSessionDelete,
    );
    this.web3Wallet.engine.signClient.events.on(
      EWalletConnectSessionEvents.session_ping,
      this.onSessionPing,
    );
    this.web3Wallet.on(
      EWalletConnectSessionEvents.session_authenticate,
      this.onAuthRequest,
    );
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
      this.onSessionProposal,
    );
    this.web3Wallet.off(
      EWalletConnectSessionEvents.session_request,
      this.onSessionRequest,
    );
    this.web3Wallet.off(
      EWalletConnectSessionEvents.session_delete,
      this.onSessionDelete,
    );
    this.web3Wallet.engine.signClient.events.off(
      EWalletConnectSessionEvents.session_ping,
      this.onSessionPing,
    );
    this.web3Wallet.off(
      EWalletConnectSessionEvents.session_authenticate,
      this.onAuthRequest,
    );
  }

  onSessionProposal = async (proposal: WalletKitTypes.SessionProposal) => {
    const { serviceWalletConnect, serviceDApp } = this.backgroundApi;
    console.log('onSessionProposal: ', JSON.stringify(proposal));
    const requiredNamespaces = proposal?.params?.requiredNamespaces ?? {};
    const optionalNamespaces = proposal?.params?.optionalNamespaces ?? {};
    const optionalNamespacesString = Object.keys(optionalNamespaces).join(', ');
    // check if all required networks are supported
    const notSupportedChains =
      await serviceWalletConnect.getNotSupportedChains(requiredNamespaces);
    // A required namespace the wallet has no impl for is left out of the
    // approve payload, which then fails the SDK's requiredNamespaces
    // conformance check after the user already tapped Approve. Catch it here:
    // getNotSupportedChains only inspects the chains an entry declares.
    const notSupportedNamespaces =
      await serviceWalletConnect.getNotSupportedNamespaces(requiredNamespaces);
    // CAIP-25 proposals commonly leave requiredNamespaces empty and put every
    // chain in optionalNamespaces. Both checks above are no-ops in that case,
    // so a wallet-only-supports-EVM proposal for solana/bip122/tron would
    // otherwise open the approval modal with zero selectable accounts, let the
    // user tap Approve, and only then fail inside approveSession -- reported
    // to the dApp as SESSION_SETTLEMENT_FAILED instead of
    // UNSUPPORTED_NAMESPACE_KEY, and to the user as an approval that silently
    // did nothing. Only reject on this path once every optional namespace is
    // unsupported: a mixed proposal (e.g. optional eip155 + solana) still has
    // something to approve.
    const optionalNamespaceKeys = Object.keys(optionalNamespaces);
    const notSupportedOptionalNamespaces =
      Object.keys(requiredNamespaces).length === 0 &&
      optionalNamespaceKeys.length > 0
        ? await serviceWalletConnect.getNotSupportedNamespaces(
            optionalNamespaces,
          )
        : [];
    const allOptionalNamespacesUnsupported =
      optionalNamespaceKeys.length > 0 &&
      notSupportedOptionalNamespaces.length === optionalNamespaceKeys.length;
    const origin = uriUtils.safeGetWalletConnectOrigin(proposal);

    const metadata = proposal.params.proposer.metadata;
    if (
      notSupportedChains.length > 0 ||
      notSupportedNamespaces.length > 0 ||
      allOptionalNamespacesUnsupported
    ) {
      const unsupportedNamespaceLabel =
        notSupportedNamespaces[0] ?? notSupportedOptionalNamespaces[0];
      const notSupportedLabel = notSupportedChains.length
        ? `ChainId: ${notSupportedChains[0]}`
        : `Namespace: ${unsupportedNamespaceLabel}`;
      console.error(
        'ProviderApiWalletConnect ERROR: onSessionProposal not supported',
        notSupportedChains,
        notSupportedNamespaces,
        notSupportedOptionalNamespaces,
      );
      await this.web3Wallet?.rejectSession({
        id: proposal.id,
        reason: notSupportedChains.length
          ? getSdkError('UNSUPPORTED_CHAINS')
          : getSdkError('UNSUPPORTED_NAMESPACE_KEY'),
      });
      void this.backgroundApi.serviceApp.showToast({
        method: 'error',
        title: notSupportedLabel,
        message: 'Unsupported yet',
      });
      defaultLogger.discovery.dapp.dappUse({
        dappName: metadata.name,
        dappDomain: metadata.url,
        action: 'ConnectWallet',
        network: optionalNamespacesString,
        failReason: `Unsupported ${notSupportedLabel}`,
      });
      return;
    }

    // Tracks whether the user already approved the proposal, so a failure after
    // that point is not reported to the dApp as a rejection by the user.
    let userApproved = false;
    // Settling consumes the proposal. Rejecting afterwards would target a
    // proposal that no longer exists while the session stays live, so failures
    // past this point are only logged.
    let sessionSettled = false;

    try {
      if (!origin) {
        const message = appLocale.intl.formatMessage({
          id: ETranslations.browser_invalid_url,
        });
        await this.web3Wallet?.rejectSession({
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
      // openModal only resolves once the user taps Approve.
      userApproved = true;
      const newSession = await this.web3Wallet?.approveSession({
        id: proposal.id,
        namespaces: result.supportedNamespaces,
      });
      sessionSettled = true;
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
      console.error('onSessionProposal error: ', e);
      if (!sessionSettled) {
        try {
          await this.web3Wallet?.rejectSession({
            id: proposal.id,
            reason: userApproved
              ? getSdkError('SESSION_SETTLEMENT_FAILED')
              : getSdkError('USER_REJECTED'),
          });
        } catch (rejectError) {
          // reject() throws by itself when the proposal is already gone — it
          // expires after five minutes, and a reject while offline throws too.
          // Swallow it so the logging below still runs.
          console.error('onSessionProposal rejectSession error: ', rejectError);
        }
      }
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

  onSessionRequest = async (request: WalletKitTypes.SessionRequest) => {
    console.log('onSessionRequest: ', request);
    const { topic, id } = request;
    const { serviceWalletConnect } = this.backgroundApi;

    // check request method is supported
    const chain = await serviceWalletConnect.getWcChainInfo(
      request.params.chainId,
    );
    if (!chain) {
      await this.web3Wallet?.respondSessionRequest({
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
      await this.web3Wallet?.respondSessionRequest({
        topic,
        response: {
          id,
          jsonrpc: '2.0',
          error: getSdkError('UNSUPPORTED_METHODS'),
        },
      });
      return;
    }

    try {
      const networkImpl = await serviceWalletConnect.getNetworkImplByNamespace(
        chain.wcNamespace,
      );
      const requestProxy = this.getRequestProxy({ networkImpl });

      // If the requested chainId does not match the one stored locally, switch the network.
      await this.switchNetwork({
        request,
        requestProxy,
      });
      const ret = await requestProxy.request(
        { sessionRequest: request, wcChain: chain.wcChain },
        request.params.request,
      );
      console.log('====>onSessionRequest ret: ', ret);

      await this.web3Wallet?.respondSessionRequest({
        topic,
        response: {
          id,
          jsonrpc: '2.0',
          result: ret,
        },
      });
    } catch (error: any) {
      await this.web3Wallet?.respondSessionRequest({
        topic,
        response: {
          id,
          jsonrpc: '2.0',
          error: getSdkError('USER_REJECTED', (error as Error)?.message),
        },
      });
    }
  };

  onSessionDelete = (args: WalletKitTypes.SessionDelete) => {
    console.log('onSessionDelete: ', args);
    console.log(this.web3Wallet?.getActiveSessions());
    void this.backgroundApi.serviceWalletConnect.handleSessionDelete(
      args.topic,
    );
  };

  onAuthRequest = (args: WalletKitTypes.SessionAuthenticate) => {
    console.log('onAuthRequest: ', args);
  };

  onSessionPing = () => {
    console.log('ping');
  };

  @backgroundMethod()
  async switchNetwork({
    request,
    requestProxy,
  }: {
    request: WalletKitTypes.SessionRequest;
    requestProxy: WalletConnectRequestProxy;
  }) {
    const { topic, id } = request;
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
    if (!accountsInfo?.[0].accountInfo.networkId || !chainInfo?.networkId) {
      await this.web3Wallet?.respondSessionRequest({
        topic,
        response: {
          id,
          jsonrpc: '2.0',
          error: getSdkError('USER_REJECTED', 'No connected account'),
        },
      });
      return;
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
    await this.web3Wallet.pair({ uri });
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
