import { Linking } from 'react-native';

import { WALLET_TYPE_EXTERNAL } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import {
  DAPP_SIDE_SINGLE_WALLET_MODE,
  WALLET_CONNECT_CLIENT_META,
  WALLET_CONNECT_LOGGER_LEVEL,
  WC_DAPP_SIDE_EVENTS_EVM,
  WC_DAPP_SIDE_METHODS_EVM,
} from '@onekeyhq/shared/src/walletConnect/constant';
import type {
  IWalletConnectChainString,
  IWalletConnectEventSessionDeleteParams,
  IWalletConnectEventSessionEventParams,
  IWalletConnectEventSessionUpdateParams,
  IWalletConnectSignClient,
} from '@onekeyhq/shared/src/walletConnect/types';
import {
  EWalletConnectNamespaceType,
  EWalletConnectSessionEvents,
} from '@onekeyhq/shared/src/walletConnect/types';

import { WalletConnectDappProvider } from './WalletConnectDappProvider';
import walletConnectClient from './walletConnectClient';
import walletConnectStorage from './walletConnectStorage';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBExternalAccount } from '../../dbs/local/types';

// https://github.com/WalletConnect/walletconnect-test-wallet

/*
var p = await $$wc.createWalletConnectDappProvider()
console.log(p.session.peer.metadata);
console.log(p.session.namespaces.eip155.accounts);

// https://docs.walletconnect.com/advanced/providers/universal#provider-methods
*/

export class WalletConnectDappSide {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  sharedClient: IWalletConnectSignClient | undefined;

  async getSharedClient() {
    if (!this.sharedClient) {
      this.sharedClient = await walletConnectClient.getDappSideClient();
      // TODO off event
      this.sharedClient.on(
        EWalletConnectSessionEvents.session_delete,
        this.handleSessionDelete,
      );
      this.sharedClient.on(
        EWalletConnectSessionEvents.session_update,
        this.handleSessionUpdate,
      );
      this.sharedClient.on(
        EWalletConnectSessionEvents.session_event,
        this.handleSessionEvent,
      );
    }
    return this.sharedClient;
  }

  handleSessionEvent = async (p: IWalletConnectEventSessionEventParams) => {
    console.log('***** session_event', p);
    await this.backgroundApi.serviceAccount.updateExternalAccountSelectedAddress(
      {
        wcSessionTopic: p.topic,
        wcSessionEvent: p,
      },
    );
  };

  handleSessionDelete = async (p: IWalletConnectEventSessionDeleteParams) => {
    console.log('***** session_delete', p);
    console.log('remove account by topic', p.topic);
    try {
      await this.backgroundApi.serviceAccount.removeExternalAccount({
        wcSessionTopic: p.topic,
      });
    } catch (error) {
      console.error(error);
    }
    await this.disconnectProvider({ topic: p.topic });
  };

  handleSessionUpdate = async (p: IWalletConnectEventSessionUpdateParams) => {
    // update accounts, networks
    console.log('***** session_update', {
      p,
    });
    // only handle matched topic
    await this.backgroundApi.serviceAccount.updateExternalAccount({
      wcSessionTopic: p.topic,
      wcNamespaces: p.params.namespaces,
    });
  };

  async disconnectProvider({ topic }: { topic: string }) {
    if (!topic) return;

    const provider = await this.getOrCreateProvider({ topic });

    const destroy = async (p: WalletConnectDappProvider | undefined) => {
      try {
        await p?.disconnect();
      } catch (error) {
        console.error(error);
      }
      try {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await p?.cleanup();
      } catch (error) {
        console.error(error);
      }
      try {
        await p?.cleanupPendingPairings({ deletePairings: true });
      } catch (error) {
        console.error(error);
      }
      // TODO save all event on listener, and remove it on destroy
    };

    try {
      await destroy(provider);
    } catch (error) {
      console.error(error);
    }

    try {
      await destroy(this.providers[topic]);
    } catch (error) {
      console.error(error);
    }

    // remove provider cache
    delete this.providers[topic];
  }

  providers: {
    [topic: string]: WalletConnectDappProvider;
  } = {};

  async getOrCreateProvider({
    topic,
    createNewTopic,
    updateDB,
  }: {
    topic: string | undefined;
    createNewTopic?: boolean;
    updateDB?: boolean; // set true if sign tx or connect new session
  }): Promise<WalletConnectDappProvider> {
    let provider: WalletConnectDappProvider | undefined;

    if (!topic && !createNewTopic) {
      throw new Error('topic or createNewTopic is required');
    }
    if (createNewTopic) {
      // eslint-disable-next-line no-param-reassign
      topic = undefined;
    }

    if (
      topic &&
      this.providers[topic] &&
      this.providers[topic]?.session?.topic === topic
    ) {
      provider = this.providers[topic];
    }

    if (!provider) {
      const client = await this.getSharedClient();
      provider = await WalletConnectDappProvider.initPro({
        ...walletConnectClient.sharedOptions,
        logger: WALLET_CONNECT_LOGGER_LEVEL,
        metadata: WALLET_CONNECT_CLIENT_META,
        client,
        storage: walletConnectStorage.dappSideStorage,
        sessionTopic: topic,
      });
    }

    // sync walletconnect session data to db
    if (provider?.session && updateDB) {
      try {
        await this.backgroundApi.serviceAccount.updateExternalAccount({
          wcSessionTopic: provider.session?.topic,
          wcNamespaces: provider.session?.namespaces,
        });
      } catch (error) {
        console.error(error);
      }
    }

    if (provider?.session?.topic) {
      this.providers[provider?.session?.topic] = provider;
    }

    if (
      topic &&
      provider?.session?.topic &&
      topic !== provider?.session?.topic
    ) {
      Object.entries(this.providers).forEach(([k, v]) => {
        console.error(
          'getOrCreateProvider ERROR: topic mismatched: ',
          k,
          v?.session?.topic,
        );
      });
      throw new Error('getOrCreateProvider ERROR: topic mismatched');
    }

    return provider;
  }

  openNativeWalletAppByDeepLink({
    account,
    delay = 1000,
  }: {
    account: IDBExternalAccount;
    delay?: number; // wait provider.request() send done
  }) {
    console.log('call openWalletNativeAppByDeepLink');
    if (!platformEnv.isNative) {
      return;
    }
    setTimeout(async () => {
      // TODO how to check this account is connected by deeplink redirect at same device,
      //      but not qrcode scan from another device
      // StorageUtil.setDeepLinkWallet()   StorageUtil.removeDeepLinkWallet()
      const redirect = account.wcInfo?.peerMeta?.redirect;
      const openApp = async (url: string | undefined) => {
        if (url && (await Linking.canOpenURL(url))) {
          await Linking.openURL(url);
          return true;
        }
        return false;
      };
      const r = await openApp(redirect?.universal);
      if (!r) {
        await openApp(redirect?.native);
      }
    }, delay);
  }

  async testExternalAccountPersonalSign({
    address,
    wcChain,
    topic,
    account,
  }: {
    address: string;
    wcChain: IWalletConnectChainString;
    topic: string;
    account: IDBExternalAccount;
  }) {
    const message = `My email is john@doe.com - ${Date.now()}`;
    const hexMsg = bufferUtils.textToHex(message, 'utf-8');
    // personal_sign params
    const params = [hexMsg, address];
    const provider = await this.getOrCreateProvider({
      topic,
      updateDB: true,
    });
    const payload = {
      method: 'personal_sign',
      params,
    };
    console.log(
      'testExternalAccountPersonalSign',
      payload,
      topic,
      provider.session?.namespaces?.eip155,
      provider.session?.topic,
    );
    this.openNativeWalletAppByDeepLink({
      account,
    });
    const result = await provider.request(payload, wcChain);
    console.log('testExternalAccountPersonalSign RESULT: ', payload, result);

    return result as string;
  }

  openModal({ uri }: { uri: string }) {
    // emit event
    appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
      uri,
    });
  }

  closeModal() {
    // emit event
    appEventBus.emit(EAppEventBusNames.WalletConnectCloseModal, undefined);
  }

  async activateSession({ topic }: { topic: string }) {
    // refresh account address from walletconnect session
    await this.getOrCreateProvider({ topic, updateDB: true });
  }

  async connectToWallet() {
    console.log('WalletConnectDappSide connectToWallet111');

    this.closeModal();

    const chains = await this.backgroundApi.serviceWalletConnect.getAllChains();

    // https://docs.walletconnect.com/advanced/multichain/chain-list
    // const allChains = chains.map((item) => item.wcChain);

    // const cosmosChains = chains
    //   .filter((item) => item.wcNamespace === EWalletConnectNamespaceType.cosmos)
    //   .map((item) => item.wcChain);

    // https://github.com/WalletConnect/web-examples/tree/main/advanced/wallets/react-wallet-v2/src/data
    // https://github.com/WalletConnect/web-examples/blob/main/advanced/dapps/react-dapp-v2/src/constants/default.ts#L6
    const evmChains = chains
      .filter((item) => item.wcNamespace === EWalletConnectNamespaceType.evm)
      .map((item) => item.wcChain);

    const evmMethods = WC_DAPP_SIDE_METHODS_EVM;
    const evmEvents = WC_DAPP_SIDE_EVENTS_EVM;

    const createNewProvider = async () =>
      this.getOrCreateProvider({
        // use undefined read last session as default
        topic: undefined,
        createNewTopic: true,
        updateDB: true,
      });

    let provider = await createNewProvider();

    // disconnect previous session
    if (
      DAPP_SIDE_SINGLE_WALLET_MODE &&
      provider?.session &&
      provider?.session?.topic
    ) {
      try {
        await this.handleSessionDelete({
          id: 0,
          topic: provider.session.topic,
        });
      } catch (error) {
        console.error(error);
      } finally {
        provider = await createNewProvider();
      }
    }

    const displayUriHandler = async (uri: string) => {
      console.log('uri', uri);
      this.openModal({ uri });
    };

    const sessionDeleteHandler = async (
      p: IWalletConnectEventSessionDeleteParams,
    ) => {
      this.closeModal();
      await this.handleSessionDelete(p);
    };

    // https://docs.walletconnect.com/advanced/providers/universal#events
    provider.once(EWalletConnectSessionEvents.display_uri, displayUriHandler);
    provider.once(
      EWalletConnectSessionEvents.session_delete,
      sessionDeleteHandler,
    );

    try {
      console.log('WalletConnectDappSide connectToWallet');
      // call connect() to create new session
      await provider.connect({
        // optionalNamespaces
        optionalNamespaces: {
          // evm
          [EWalletConnectNamespaceType.evm]: {
            methods: evmMethods,
            chains: evmChains,
            events: evmEvents,
          },
          // rainbow, metamask does not support non-evm network, will throw error
          // [EWalletConnectNamespaceType.cosmos]: {
          //   // https://github.com/WalletConnect/web-examples/blob/main/advanced/dapps/react-dapp-v2/src/constants/default.ts#L80
          //   methods: ['cosmos_signDirect', 'cosmos_signAmino'],
          //   chains: ['cosmos:cosmoshub-4'],
          //   // chains: cosmosChains,
          //   events: [],
          // },
        },
      });
      if (!provider.session || !provider.isWalletConnect) {
        throw new Error('WalletConnect ERROR: Connect to wallet failed');
      }
      return provider.session;
    } finally {
      this.closeModal();
      provider.off(EWalletConnectSessionEvents.display_uri, displayUriHandler);
      provider.off(
        EWalletConnectSessionEvents.session_delete,
        sessionDeleteHandler,
      );
    }
  }

  async cleanupInactiveSessions() {
    const { accounts } =
      await this.backgroundApi.serviceAccount.getSingletonAccountsOfWallet({
        walletId: WALLET_TYPE_EXTERNAL,
      });
    const accountTopics: string[] = accounts
      .map((item) => (item as IDBExternalAccount | undefined)?.wcTopic)
      .filter(Boolean);

    const sessions = await walletConnectStorage.dappSideStorage.getSessions();
    const sessionTopics: string[] = (sessions || [])
      .map((item) => item.topic)
      .filter(Boolean);

    const inactiveSessionTopics: string[] = sessionTopics.filter(
      (topic) => !accountTopics.includes(topic),
    );
    const inactiveAccountTopics: string[] = accountTopics.filter(
      (topic) => !sessionTopics.includes(topic),
    );
    [...inactiveAccountTopics, ...inactiveSessionTopics].forEach((topic) =>
      this.handleSessionDelete({ id: 0, topic }),
    );
  }
}
