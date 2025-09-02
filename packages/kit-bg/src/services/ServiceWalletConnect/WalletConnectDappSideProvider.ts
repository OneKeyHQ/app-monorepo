/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { StorageUtil as StorageUtilCore } from '@reown/appkit-core-react-native';
import UniversalProvider from '@walletconnect/universal-provider';

import { OneKeyError, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import {
  ALGO_SIGNING_METHODS,
  COSMOS_SIGNING_METHODS,
  EIP155_SIGNING_METHODS,
  WC_DAPP_SIDE_METHODS_EVM,
} from '@onekeyhq/shared/src/walletConnect/constant';

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

  override async connect(
    opts: ConnectParams,
  ): Promise<SessionTypes.Struct | undefined> {
    return super.connect(opts);
  }

  async abortConnectPairing() {
    // @ts-ignore
    const events = this.client.engine.events as IEngineEvents;
    // TODO not working
    // as sign-client engine generate random session_connect event id,
    // eg: "session_connect:1756469336854687"
    events.emit('session_connect', {
      error: new OneKeyError({
        code: 8_376_239,
        message: 'User closed the modal',
      }),
    });
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
    // @ts-ignore
    super.registerEventListeners();
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

  // TODO cleanup, remove event listeners
}
