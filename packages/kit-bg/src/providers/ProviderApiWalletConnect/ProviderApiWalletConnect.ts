import {
  buildAuthObject,
  getSdkError,
  populateAuthPayload,
} from '@walletconnect/utils';

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
import {
  supportEventsMap,
  supportMethodsMap,
} from '@onekeyhq/shared/src/walletConnect/constant';
import {
  EWalletConnectNamespaceType,
  EWalletConnectSessionEvents,
} from '@onekeyhq/shared/src/walletConnect/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
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
    const optionalNamespaces = proposal?.params?.optionalNamespaces;
    const optionalNamespacesString = Object.keys(optionalNamespaces).join(', ');
    // check if all required networks are supported
    const notSupportedChains = await serviceWalletConnect.getNotSupportedChains(
      // proposal,
      proposal?.params?.requiredNamespaces,
    );
    const origin = uriUtils.safeGetWalletConnectOrigin(proposal);

    const metadata = proposal.params.proposer.metadata;
    // approveSession consumes the proposal, so the error handler must not
    // reject one that was already approved.
    let approvedTopic: string | undefined;
    if (notSupportedChains.length > 0) {
      console.error(
        'ProviderApiWalletConnect ERROR: onSessionProposal notSupportedChains',
        notSupportedChains,
      );
      await this.web3Wallet?.rejectSession({
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
      const newSession = await this.web3Wallet?.approveSession({
        id: proposal.id,
        namespaces: result.supportedNamespaces,
      });
      approvedTopic = newSession?.topic;

      try {
        await serviceDApp.saveConnectionSession({
          origin,
          accountsInfo: result.accountsInfo,
          storageType: 'walletConnect',
          walletConnectTopic: approvedTopic,
        });
      } catch (saveError) {
        // The session is already live on the relay, but without a stored
        // connection it never shows up in connected sites and the user has no
        // way to end it. Tear it down instead of leaking it.
        if (approvedTopic) {
          try {
            await serviceWalletConnect.walletConnectDisconnect(approvedTopic);
          } catch (disconnectError) {
            console.error(
              'onSessionProposal disconnect after failed save error: ',
              disconnectError,
            );
          }
        }
        throw saveError;
      }

      void serviceWalletConnect.batchEmitNetworkChangedEvent({
        topic: approvedTopic ?? '',
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
      if (!approvedTopic) {
        await this.web3Wallet?.rejectSession({
          id: proposal.id,
          reason: getSdkError('USER_REJECTED'),
        });
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

  onAuthRequest = async (args: WalletKitTypes.SessionAuthenticate) => {
    console.log('onAuthRequest: ', args);
    const { serviceWalletConnect, serviceDApp } = this.backgroundApi;
    const { id, params } = args;
    const metadata = params.requester.metadata;
    const evmNamespace = EWalletConnectNamespaceType.evm;

    // approveSessionAuthenticate/rejectSessionAuthenticate consume the request,
    // so the error handler must not answer one that was already approved.
    let answered = false;
    const rejectAuth = async (reason: { code: number; message: string }) => {
      if (answered) {
        return;
      }
      answered = true;
      try {
        await this.web3Wallet?.rejectSessionAuthenticate({ id, reason });
      } catch (rejectError) {
        console.error('rejectSessionAuthenticate error: ', rejectError);
      }
    };

    // One-click auth signs a CACAO, which this wallet only produces for EVM.
    const supportedChains: string[] = [];

    try {
      // safeGetWalletConnectOrigin only reads params.proposer.metadata, which
      // the authenticate payload carries as params.requester.
      const origin = uriUtils.safeGetWalletConnectOrigin({
        params: { proposer: params.requester },
      } as WalletKitTypes.SessionProposal);

      if (!origin) {
        const message = appLocale.intl.formatMessage({
          id: ETranslations.browser_invalid_url,
        });
        await rejectAuth({ message, code: 40_001 });
        void this.backgroundApi.serviceApp.showToast({
          method: 'error',
          title: message,
        });
        return;
      }

      const requestedChains = params.authPayload.chains ?? [];
      for (const chain of requestedChains) {
        if (!chain.startsWith(`${evmNamespace}:`)) {
          continue;
        }
        const chainInfo = await serviceWalletConnect.getWcChainInfo(chain);
        if (chainInfo) {
          supportedChains.push(chain);
        }
      }

      if (supportedChains.length === 0) {
        await rejectAuth(getSdkError('UNSUPPORTED_CHAINS'));
        void this.backgroundApi.serviceApp.showToast({
          method: 'error',
          title: `ChainId: ${requestedChains[0] ?? ''}`,
          message: 'Unsupported yet',
        });
        return;
      }

      const methods = supportMethodsMap[evmNamespace] ?? [];
      // Throws when the dApp asks for a ReCap the wallet cannot satisfy; the
      // catch below turns that into an explicit rejection.
      const authPayload = populateAuthPayload({
        authPayload: params.authPayload,
        chains: supportedChains,
        methods,
      });

      // Shaped like a session proposal so the existing approval modal and
      // getSessionApprovalAccountInfo work without a dedicated screen.
      const proposal = {
        id,
        params: {
          id,
          expiryTimestamp: params.expiryTimestamp,
          relays: [],
          proposer: params.requester,
          requiredNamespaces: {},
          optionalNamespaces: {
            [evmNamespace]: {
              chains: supportedChains,
              methods,
              events: supportEventsMap[evmNamespace] ?? [],
            },
          },
        },
        verifyContext: args.verifyContext,
      } as unknown as WalletKitTypes.SessionProposal;

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

      const accountInfo = result.accountsInfo?.[0];
      if (!accountInfo?.address || !accountInfo?.networkId) {
        throw new OneKeyLocalError('No account selected for authentication');
      }

      // The approval modal lets the user pick the network among the requested
      // chains, so the CACAO belongs to that network and not to the first
      // supported one: formatAuthMessage takes the `Chain ID` line of the SIWE
      // body from `iss`, and approveSessionAuthenticate scopes the session
      // accounts by it.
      const wcChain = await serviceWalletConnect.getWcChainByNetworkId({
        networkId: accountInfo.networkId,
      });
      // CAIP-122 issuer: did:pkh:<namespace>:<reference>:<address>
      const iss = `did:pkh:${wcChain}:${accountInfo.address}`;
      const authMessage = this.web3Wallet?.formatAuthMessage({
        request: authPayload,
        iss,
      });
      if (!authMessage) {
        throw new OneKeyLocalError(
          'Failed to build the authentication message',
        );
      }

      const message = `0x${Buffer.from(authMessage, 'utf8').toString('hex')}`;
      const signature = (await serviceDApp.openSignMessageModal({
        request: {
          scope: '$walletConnect',
          origin,
          // This screen is the step that actually authorizes the login, so it
          // needs the same identity attestation the proposal screen gets from
          // `proposal.verifyContext`. ServiceDApp.openModal hoists this back
          // onto $sourceInfo for useRiskDetection — the convention
          // WalletConnectRequestProxy already follows for session_request.
          data: {
            walletConnectVerifyContext: args.verifyContext,
          },
        },
        accountId: accountInfo.accountId,
        networkId: accountInfo.networkId,
        unsignedMessage: {
          type: EMessageTypesEth.PERSONAL_SIGN,
          message,
          payload: [message, accountInfo.address],
        },
      })) as string;

      const auth = buildAuthObject(
        authPayload,
        { t: 'eip191', s: signature },
        iss,
      );

      const approved = await this.web3Wallet?.approveSessionAuthenticate({
        id,
        auths: [auth],
      });
      answered = true;

      // A request that only asks for authentication (no ReCap methods) is
      // approved without a session being established, so there is no topic to
      // persist and nothing to show in the connected-sites list.
      const topic = approved?.session?.topic;
      if (topic) {
        try {
          await serviceDApp.saveConnectionSession({
            origin,
            accountsInfo: result.accountsInfo,
            storageType: 'walletConnect',
            walletConnectTopic: topic,
          });
        } catch (saveError) {
          // The session is already live on the relay, but without a stored
          // connection it never shows up in connected sites and the user has
          // no way to end it. Tear it down instead of leaking it.
          try {
            await serviceWalletConnect.walletConnectDisconnect(topic);
          } catch (disconnectError) {
            console.error(
              'onAuthRequest disconnect after failed save error: ',
              disconnectError,
            );
          }
          throw saveError;
        }

        void serviceWalletConnect.batchEmitNetworkChangedEvent({
          topic,
          accountsInfo: result.accountsInfo,
        });
      }

      defaultLogger.discovery.dapp.dappUse({
        dappName: metadata.name,
        dappDomain: metadata.url,
        action: 'ConnectWallet',
        network: wcChain,
      });
    } catch (e) {
      console.error('onAuthRequest error: ', e);
      await rejectAuth(getSdkError('USER_REJECTED'));
      defaultLogger.discovery.dapp.dappUse({
        dappName: metadata.name,
        dappDomain: metadata.url,
        action: 'ConnectWallet',
        network: supportedChains.join(', '),
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        failReason: `${e?.message ?? e}`,
      });
    }
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
