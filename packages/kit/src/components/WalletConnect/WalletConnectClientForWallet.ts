// eslint-disable-next-line import/order
import './utils/walletConnectV2SdkShims';

import { Core, RELAYER_EVENTS } from '@walletconnect-v2/core';
import { getSdkError } from '@walletconnect-v2/utils';
import { Web3Wallet } from '@walletconnect-v2/web3wallet';
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
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import { getTimeDurationMs, wait } from '../../utils/helper';
import Minimizer from '../Minimizer';

import walletConnectUtils from './utils/walletConnectUtils';
import { WalletConnectClientBase } from './WalletConnectClient';
import {
  WALLET_CONNECT_CLIENT_META,
  WALLET_CONNECT_V2_PROJECT_ID,
} from './walletConnectConsts';
import { WalletConnectSessionStorage } from './WalletConnectSessionStorage';

import type { IWalletConnectRequestOptions } from './types';
import type { IWalletConnectClientOptions } from './WalletConnectClient';
import type { ISessionStatusPro } from './WalletConnectClientForDapp';
import type {
  JsonRpcRecord,
  PendingRequestTypes,
  SessionTypes,
} from '@walletconnect-v2/types';
import type {
  IWeb3Wallet,
  Web3WalletTypes,
} from '@walletconnect-v2/web3wallet';
import type {
  IKeyValueStorage,
  KeyValueStorageOptions,
} from '@walletconnect/keyvaluestorage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { IClientMeta, ISessionStatus } from '@walletconnect/types';

import { waitForDataLoaded } from '@onekeyhq/shared/src/background/backgroundUtils';

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

  async initWeb3WalletV2(delay = 0) {
    // https://github.com/WalletConnect/walletconnect-monorepo/blob/v2.0/packages/core/src/controllers/relayer.ts#L315
    try {
      await wait(delay);
      if (this.web3walletV2) {
        return;
      }
      await this.createWeb3WalletV2();
    } catch (error) {
      console.error('createWeb3WalletV2 ERROR:', error);
    }
  }

  async recreateWeb3WalletV2() {
    // Web3Wallet instance exists, no need to recreate
    if (this.web3walletV2 || this.web3walletV2Core) {
      return;
    }
    await wait(5000);
    return this.createWeb3WalletV2();
  }

  async createWeb3WalletV2() {
    const storageOptions: KeyValueStorageOptions | undefined = {
      database: ':memory:',
      table: 'walletconnect.db',
    };

    // import KeyValueStorage from '@walletconnect/keyvaluestorage';
    // browser & native env should use default storage, otherwise it will cause error:
    //      cannot convert null or undefined to object
    //      @walletconnect/keyvaluestorage will handle json parse/stringify before setItem & getItem
    let storage: IKeyValueStorage | undefined;
    if (platformEnv.isManifestV3 && platformEnv.isExtension) {
      storage = appStorage as any;
    }

    // storage = new KeyValueStorage({ ...CORE_STORAGE_OPTIONS, ...opts?.storageOptions });
    // TODO shared singleton Core instance for wallet and dapp?
    const core = new Core({
      projectId: WALLET_CONNECT_V2_PROJECT_ID,
      storage,
      storageOptions,
    });
    // @ts-ignore
    core.isWalletSide = true;
    this.web3walletV2Core = core;

    // https://github.com/WalletConnect/walletconnect-monorepo/blob/v2.0/packages/core/src/controllers/relayer.ts#L222
    core?.relayer?.once(RELAYER_EVENTS.transport_closed, (error0: any) => {
      // $backgroundApiProxy.backgroundApi.walletConnect.web3walletV2Core.relayer.restartTransport()
      // $backgroundApiProxy.backgroundApi.walletConnect.web3walletV2Core.relayer.transportClose()
      // $backgroundApiProxy.backgroundApi.walletConnect.web3walletV2Core.relayer.provider.disconnect()
      // $backgroundApiProxy.backgroundApi.walletConnect.web3walletV2Core.relayer.provider.connection.close()
      console.error(
        'WalletConnect V2 Core ERROR: relayer_transport_closed >>>>>> ',
        error0,
      );

      const doReconnect = async () => {
        if (this.web3walletV2) {
          this.unregisterEventsV2(this.web3walletV2);
        }
        try {
          await core?.relayer?.provider?.connection?.close();
        } catch (error) {
          console.error(
            'WalletConnect V2 doReconnect close connection ERROR: ',
            error,
          );
        }
        this.web3walletV2Core = undefined;
        this.web3walletV2 = undefined;
        this.recreateWeb3WalletV2();
      };

      core?.relayer?.provider?.connection?.once('open', () => {
        console.error(
          'WalletConnect V2 Core ERROR: relayer_transport_closed but WebSocket still open ',
        );
        // cause multiple socket, sdk will retry(disable sdk retry function), emit close event again,
        // doReconnect();
      });

      core?.relayer?.provider?.connection?.once('close', () => {
        console.error(
          'WalletConnect V2 Core ERROR: relayer_transport_closed and WebSocket closed ',
        );
        // cause multiple socket, sdk will retry
        // doReconnect();
      });

      // https://github.com/WalletConnect/walletconnect-utils/blob/master/jsonrpc/ws-connection/src/ws.ts#L137
      core?.relayer?.provider?.connection?.once(
        'register_error',
        (error: Error) => {
          const message = (error?.message || '').slice(0, 100);
          console.error(
            'WalletConnect V2 Core ERROR: WebSocket ERROR > register_error  >>>>>> ',
            message,
          );
          doReconnect();
        },
      );
    });

    // Blocked network may cause errors below:
    //    {context: 'core'} {context: 'core/relayer'} Error: socket stalled
    //    {context: 'client'} 'closeTransport called before connection was established'
    const web3walletV2 = await Web3Wallet.init({
      core, // <- pass the shared `core` instance
      metadata: WALLET_CONNECT_CLIENT_META,
    });
    this.web3walletV2 = web3walletV2;
    await this.clearHistoryCacheV2(() => true);
    // web3walletV2.engine.signClient.proposal.
    this.registerEventsV2(this.web3walletV2);
    await this.getActiveSessionsV2();
  }

  // TODO pair expired check
  async pair(params: { uri: string }) {
    await waitForDataLoaded({
      data: () => this.web3walletV2,
      logName: 'WalletConnectV2 pair(uri) wait web3walletV2 ready.',
      timeout: getTimeDurationMs({ seconds: 30 }),
    });
    if (!this.web3walletV2) {
      throw new Error('web3walletV2 not ready yet');
    }
    return this.web3walletV2.pair({ uri: params.uri });
  }

  async disconnectPairingV2({ topic }: { topic: string }) {
    return this.web3walletV2?.core.pairing.disconnect({ topic });
  }

  async getActivePairingsV2() {
    return Promise.resolve(this.web3walletV2?.core.pairing.getPairings() ?? []);
  }

  async getSessionV2ByTopic({
    topic,
  }: {
    topic: string;
  }): Promise<SessionTypes.Struct | undefined> {
    if (!topic) {
      return undefined;
    }
    const { sessions } = await this.getActiveSessionsV2({ saveCache: false });
    let session = sessions.find((s) => s.topic === topic);
    if (!session) {
      session = this.prevActiveSessionsCache.find((s) => s.topic === topic);
    }
    return session;
  }

  prevActiveSessionsCache: SessionTypes.Struct[] = [];

  async getActiveSessionsV2({
    saveCache = true,
  }: { saveCache?: boolean } = {}): Promise<{
    sessions: SessionTypes.Struct[];
  }> {
    const sessions: SessionTypes.Struct[] = Object.values(
      this.web3walletV2?.getActiveSessions() ?? {},
    );
    if (saveCache) {
      this.prevActiveSessionsCache = sessions;
    }
    return Promise.resolve({
      sessions,
    });
  }

  abstract unregisterEventsV2(web3walletV2: IWeb3Wallet): void;

  abstract registerEventsV2(web3walletV2: IWeb3Wallet): void;

  abstract getSessionStatusToApprove(
    options: IWalletConnectRequestOptions,
  ): Promise<ISessionStatusPro>;

  previousUri: string | undefined;

  async redirectToDapp(options: IWalletConnectRequestOptions) {
    const { connector } = options;
    if (!connector) {
      return;
    }
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async connectV2({ uri, isDeepLink }: { uri: string; isDeepLink?: boolean }) {
    return this.pair({ uri });
  }

  // TODO connecting check, thread lock
  // connectToDapp
  @backgroundMethod()
  async connect({ uri, isDeepLink }: { uri: string; isDeepLink?: boolean }) {
    // eslint-disable-next-line no-param-reassign
    uri = uri?.trim() || uri;

    const uriInfo = walletConnectUtils.getWalletConnectUriInfo({ uri });
    if (uriInfo?.v2) {
      return this.connectV2({ uri, isDeepLink });
    }

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
    const origin = this.getConnectorOrigin({ connector });
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

  async clearExpirationsCacheV2() {
    try {
      const expirationsKeys = Array.from(
        this.web3walletV2?.core.expirer.keys ?? [],
      );
      if (expirationsKeys?.length) {
        await Promise.all(
          expirationsKeys.map((key) =>
            this.web3walletV2?.core.expirer.del(key),
          ),
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  async clearRequestsCacheV2(
    filter: (item: PendingRequestTypes.Struct) => boolean,
  ) {
    try {
      const requests = this.web3walletV2?.getPendingSessionRequests();
      if (requests?.length) {
        await Promise.all(
          requests?.filter(filter).map((r) =>
            this.rejectSessionRequestV2({
              request: r as any,
              error: new Error('Wallet destroy'),
            }),
          ),
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  async clearSessionsCacheV2() {
    try {
      const { sessions } = await this.getActiveSessionsV2({ saveCache: false });
      await Promise.all(
        sessions.map((s) =>
          this.disconnectV2({
            sessionV2: s,
            clearWalletIfEmptySessions: false,
          }),
        ),
      );
    } catch (error) {
      console.error(error);
    }
  }

  async clearProposalsCacheV2() {
    try {
      const proposals = Object.values(
        this.web3walletV2?.getPendingSessionProposals() ?? {},
      );
      if (proposals?.length) {
        await Promise.all(
          proposals?.map(async (p) => {
            const session = await this.web3walletV2?.rejectSession({
              id: p.id,
              reason: getSdkError('USER_REJECTED_METHODS', 'Wallet destroy'),
            });
            return session;
          }),
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  async clearPairingsCacheV2() {
    try {
      const pairings = await this.getActivePairingsV2();
      await Promise.all(
        pairings.map((p) => this.disconnectPairingV2({ topic: p.topic })),
      );
    } catch (error) {
      console.error(error);
    }
  }

  async clearHistoryCacheV2(filter: (item: JsonRpcRecord) => boolean) {
    try {
      const historyItems = Array.from(
        this.web3walletV2?.core.history.records.values() ?? [],
      );
      if (historyItems?.length) {
        await Promise.all(
          historyItems
            .filter(filter)
            .map((item) => this.web3walletV2?.core.history.delete(item.topic)),
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  async clearMessagesCacheV2() {
    try {
      const messagesKeys = Array.from(
        this.web3walletV2?.core.relayer.messages.messages.keys() ?? [],
      );
      if (messagesKeys?.length) {
        await Promise.all(
          messagesKeys.map((key) =>
            this.web3walletV2?.core.relayer.messages.del(key),
          ),
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  async clearKeychainsCacheV2() {
    try {
      const keychainKeys = Array.from(
        this.web3walletV2?.core.crypto.keychain.keychain.keys() ?? [],
      );
      if (keychainKeys?.length) {
        await Promise.all(
          keychainKeys.map((key) =>
            this.web3walletV2?.core.crypto.keychain.del(key),
          ),
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  @backgroundMethod()
  async clearAllWalletCacheV2() {
    // **** DO Not remove expirer, because it will clear expired data automatically
    // await this.clearExpirationsCacheV2();

    await this.clearRequestsCacheV2(() => true);
    await this.clearSessionsCacheV2();
    await this.clearProposalsCacheV2();
    await this.clearPairingsCacheV2();
    await this.clearHistoryCacheV2(() => true);
    await this.clearMessagesCacheV2();
    await this.clearKeychainsCacheV2();

    this.prevActiveSessionsCache = [];

    // @ts-ignore
    const historyKey = this.web3walletV2?.core?.history?.storageKey;
    // @ts-ignore
    const pairingKey = this.web3walletV2?.core?.pairing?.storageKey;
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const expirerKey = this.web3walletV2?.core?.expirer?.storageKey;
    // @ts-ignore
    const keychainKey = this.web3walletV2?.core?.crypto?.keychain?.storageKey;
    const subscriberKey =
      // @ts-ignore
      this.web3walletV2?.core?.relayer?.subscriber?.storageKey;
    // @ts-ignore
    const messagesKey = this.web3walletV2?.core?.relayer?.messages?.storageKey;
    const proposalKey =
      // @ts-ignore
      this.web3walletV2?.engine?.signClient?.proposal?.storageKey;
    const sessionKey =
      // @ts-ignore
      this.web3walletV2?.engine?.signClient?.session?.storageKey;
    const requestKey =
      // @ts-ignore
      this.web3walletV2?.engine?.signClient?.pendingRequest?.storageKey;

    [
      // **** DO Not remove expirer, because it will clear expired data automatically
      // expirerKey,
      historyKey,
      pairingKey,
      keychainKey,
      subscriberKey,
      messagesKey,
      proposalKey,
      sessionKey,
      requestKey,
    ]
      .filter(Boolean)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .forEach((key) => {
        // **** keep storage data here, use this.clearXXXX() instead.
        this.web3walletV2?.core?.storage?.removeItem(key);
      });

    await wait(300);
  }

  abstract rejectSessionRequestV2({
    request,
    error,
  }: {
    request: Web3WalletTypes.SessionRequest;
    error: Error;
  }): Promise<void> | undefined;

  abstract disconnectV2({
    sessionV2,
    topic,
    clearWalletIfEmptySessions = true,
  }: {
    sessionV2?: SessionTypes.Struct;
    topic?: string;
    clearWalletIfEmptySessions?: boolean;
  }): Promise<void>;
}
