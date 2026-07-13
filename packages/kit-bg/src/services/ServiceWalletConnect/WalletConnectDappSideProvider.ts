/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { StorageUtil as StorageUtilCore } from '@reown/appkit-core-react-native';
import UniversalProvider from '@walletconnect/universal-provider';
import { engineEvent, getSdkError, parseUri } from '@walletconnect/utils';

import {
  OneKeyLocalError,
  OneKeyWalletConnectModalCloseError,
} from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import {
  ALGO_SIGNING_METHODS,
  COSMOS_SIGNING_METHODS,
  EIP155_SIGNING_METHODS,
  WC_DAPP_SIDE_METHODS_EVM,
} from '@onekeyhq/shared/src/walletConnect/constant';
import type { IWalletConnectSignClient } from '@onekeyhq/shared/src/walletConnect/types';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBExternalAccount } from '../../dbs/local/types';
import type { IEngineEvents, SessionTypes } from '@walletconnect/types';
import type {
  ConnectParams,
  NamespaceConfig,
  RequestArguments,
  UniversalProviderOpts,
} from '@walletconnect/universal-provider';

export type IWalletConnectDappProviderOpts = UniversalProviderOpts & {
  sessionTopic: string | undefined;
  backgroundApi: IBackgroundApi;
};

type IClientEventListener = (...args: unknown[]) => unknown;
type IClientOn = (
  event: string,
  listener: IClientEventListener,
) => IWalletConnectSignClient;

// TODO check UniversalProvider.registerEventListeners for topic specified events
// create multiple providers for different topics, delete one topic may cleanup all session of shared client

export class WalletConnectDappSideProvider extends UniversalProvider {
  // use shared events, as it may be setGlobal() and getGlobal() at universal-provider
  // public events: EventEmitter = new EventEmitter();

  constructor(opts: IWalletConnectDappProviderOpts) {
    super(opts);
    this.backgroundApi = opts.backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  private rejectPendingConnect:
    | ((error: OneKeyWalletConnectModalCloseError) => void)
    | undefined;

  private connectAbortError: OneKeyWalletConnectModalCloseError | undefined;

  private clientEventListeners: Array<{
    event: string;
    listener: IClientEventListener;
  }> = [];

  private isDisposed = false;

  override async connect(
    opts: ConnectParams,
  ): Promise<SessionTypes.Struct | undefined> {
    this.connectAbortError = undefined;
    const cancellation = new Promise<never>((_resolve, reject) => {
      this.rejectPendingConnect = reject;
    });
    const connectPromise = super.connect(opts).then(async (session) => {
      if (session && this.connectAbortError) {
        await this.disconnectCancelledSession(session);
        throw this.connectAbortError;
      }
      return session;
    });
    try {
      return await Promise.race([connectPromise, cancellation]);
    } finally {
      this.rejectPendingConnect = undefined;
    }
  }

  private async cleanupPro(): Promise<void> {
    // @ts-ignore
    return super.cleanup();
  }

  private async disconnectCancelledSession(session: SessionTypes.Struct) {
    try {
      if (this.client.session.keys.includes(session.topic)) {
        await this.client.disconnect({
          topic: session.topic,
          reason: getSdkError('USER_DISCONNECTED'),
        });
      }
    } catch (error) {
      console.warn(
        'Failed to disconnect cancelled WalletConnect session:',
        error,
      );
    }

    if (this.session?.topic === session.topic) {
      try {
        await this.cleanupPro();
      } catch (error) {
        console.warn(
          'Failed to clean up cancelled WalletConnect session:',
          error,
        );
      }
    }
  }

  async abortConnectPairing() {
    const closeError = new OneKeyWalletConnectModalCloseError();
    this.connectAbortError = closeError;
    this.rejectPendingConnect?.(closeError);

    if (this.session) {
      await this.disconnectCancelledSession(this.session);
    }

    const uri = this.uri;
    this.uri = undefined;
    if (!uri) {
      this.once('display_uri', () => {
        void this.abortConnectPairing();
      });
      return;
    }

    try {
      const { topic: pairingTopic } = parseUri(uri);
      const proposal = this.client.proposal
        .getAll()
        .find((item) => item.pairingTopic === pairingTopic);

      if (proposal) {
        // @ts-ignore
        const events = this.client.engine.events as IEngineEvents;
        events.emit(engineEvent('session_connect', proposal.id), {
          error: closeError.serialize(),
        });
        this.client.core.expirer.set(proposal.id, 0);
      }

      if (this.client.core.pairing.pairings.keys.includes(pairingTopic)) {
        await this.client.core.pairing.disconnect({ topic: pairingTopic });
      }
    } catch (error) {
      console.warn('Failed to clean up WalletConnect pairing:', error);
    }
  }

  // @ts-ignore
  override async request<T = unknown>({
    args,
    wcChain,
    expiry,
    account,
  }: {
    args: RequestArguments;
    wcChain: string;
    expiry?: number | undefined;
    account: IDBExternalAccount | undefined;
  }): Promise<T> {
    if (!wcChain) {
      throw new OneKeyLocalError(
        'WalletConnectDappSideProvider.request ERROR: wcChain is required',
      );
    }
    const shouldCallDeepLinkMethod = [
      ...WC_DAPP_SIDE_METHODS_EVM,
      ...Object.values(EIP155_SIGNING_METHODS),
      ...Object.values(COSMOS_SIGNING_METHODS),
      ...Object.values(ALGO_SIGNING_METHODS),
    ];
    let fallbackSdkSavedDeeplink: { href: string; name: string } | undefined;
    if (
      platformEnv.isNative &&
      account &&
      shouldCallDeepLinkMethod.includes(args.method)
    ) {
      fallbackSdkSavedDeeplink =
        await StorageUtilCore.getWalletConnectDeepLink();

      if (fallbackSdkSavedDeeplink) {
        // disable sdk default deeplink handler by remove storage
        await StorageUtilCore.removeWalletConnectDeepLink();

        this.backgroundApi.serviceWalletConnect.dappSide.openNativeWalletAppByDeepLink(
          {
            account,
            fallbackSdkSavedDeeplink,
            delay: 2000, // wait request message send done by websocket
          },
        );
      }
    }
    try {
      const result = await super.request<T>(args, wcChain, expiry);
      return result;
    } finally {
      if (fallbackSdkSavedDeeplink) {
        console.log(
          'StorageUtilCore.setWalletConnectDeepLink',
          fallbackSdkSavedDeeplink,
        );
        StorageUtilCore.setWalletConnectDeepLink(fallbackSdkSavedDeeplink);
      }
    }
  }

  getFromStorePro(key: string): Promise<NamespaceConfig | undefined> {
    // @ts-ignore
    return super.getFromStore(key);
  }

  createProvidersPro(): void {
    // @ts-ignore
    return super.createProviders();
  }

  // TODO use shared client, handle setGlobal() getGlobal() at universal-provider
  // https://github.com/WalletConnect/walletconnect-monorepo/blob/v2.0/providers/universal-provider/src/UniversalProvider.ts#L287
  async createClientPro(): Promise<void> {
    this.client = checkIsDefined(this.providerOpts.client);
    this.logger.trace(`SignClient Initialized`);
  }

  registerEventListenersPro(): void {
    const originalClientOn = this.client.on;
    const callClientOn = originalClientOn as unknown as IClientOn;
    const trackedClientOn: IClientOn = (event, listener) => {
      this.clientEventListeners.push({ event, listener });
      return callClientOn(event, listener);
    };

    // UniversalProvider does not expose its client listeners, so capture only
    // the listeners registered synchronously by this provider initialization.
    this.client.on = trackedClientOn as unknown as typeof this.client.on;
    try {
      // @ts-ignore
      super.registerEventListeners();
    } finally {
      this.client.on = originalClientOn;
    }
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;

    const clientOff = this.client.off as unknown as IClientOn;
    for (const { event, listener } of this.clientEventListeners) {
      clientOff(event, listener);
    }
    this.clientEventListeners = [];
    this.events.removeAllListeners();
  }

  // https://github.com/WalletConnect/walletconnect-monorepo/blob/v2.0/providers/universal-provider/src/UniversalProvider.ts#L250
  private async checkStoragePro(opts: IWalletConnectDappProviderOpts) {
    this.namespaces = await this.getFromStorePro('namespaces');
    this.optionalNamespaces =
      (await this.getFromStorePro('optionalNamespaces')) || {};
    if (this.client.session.length) {
      let key: string | undefined;
      if (opts.sessionTopic) {
        key = opts.sessionTopic;
      } else {
        // TODO *** DO NOT auto get last session, keep it as undefined if no topic provided
        // SESSION required: Session not initialized. Please call connect() before enable()
        const lastKeyIndex = this.client.session.keys.length - 1;
        key = this.client.session.keys[lastKeyIndex];
      }
      if (key) {
        this.session = this.client.session.get(key);
      }

      if (this.session) {
        // getFromStore should read this.session.topic
        this.namespaces = (await this.getFromStorePro('namespaces')) || {};
        this.optionalNamespaces =
          (await this.getFromStorePro('optionalNamespaces')) || {};
        this.createProvidersPro();
      }
    }
  }

  //   https://github.com/WalletConnect/walletconnect-monorepo/blob/v2.0/providers/universal-provider/src/UniversalProvider.ts#L249
  private async initializePro(opts: IWalletConnectDappProviderOpts) {
    this.logger.trace(`Initialized`);
    await this.createClientPro();
    await this.checkStoragePro(opts);
    this.registerEventListenersPro();
  }

  static async initPro(opts: IWalletConnectDappProviderOpts) {
    const provider = new WalletConnectDappSideProvider(opts);
    await provider.initializePro(opts);
    return provider;
  }
}
