/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import UniversalProvider from '@walletconnect/universal-provider';

import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import type {
  NamespaceConfig,
  RequestArguments,
  UniversalProviderOpts,
} from '@walletconnect/universal-provider';

export type IWalletConnectDappProviderOpts = UniversalProviderOpts & {
  sessionTopic: string | undefined;
};

// TODO check UniversalProvider.registerEventListeners for topic specified events
// create multiple providers for different topics, delete one topic may cleanup all session of shared client

export class WalletConnectDappSideProvider extends UniversalProvider {
  // use shared events, as it may be setGlobal() and getGlobal() at universal-provider
  // public events: EventEmitter = new EventEmitter();

  // @ts-ignore
  override async request(
    args: RequestArguments,
    wcChain: string,
    expiry?: number | undefined,
  ): Promise<unknown> {
    if (!wcChain) {
      throw new Error(
        'WalletConnectDappSideProvider.request ERROR: wcChain is required',
      );
    }
    const result = await super.request(args, wcChain, expiry);
    return result;
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
      this.createProvidersPro();
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

// TODO replace native node_modules/@walletconnect/modal-react-native/src/utils/ProviderUtil.ts
