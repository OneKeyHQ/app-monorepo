import { getSdkError } from '@walletconnect/utils';
import { uniq } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  WalletConnectAccountSelectorNumStartAt,
  caipsToNetworkMap,
  implToNamespaceMap,
  namespaceToImplsMap,
  supportEventsMap,
  supportMethodsMap,
} from '@onekeyhq/shared/src/walletConnect/constant';
import type {
  ICaipsInfo,
  INamespaceUnion,
  IWalletConnectAddressString,
  IWalletConnectChainInfo,
  IWalletConnectChainString,
  IWalletConnectConnectToWalletParams,
  IWalletConnectOptionalNamespaces,
  IWalletConnectRequiredNamespaces,
  IWalletConnectSession,
  IWcChainAddress,
} from '@onekeyhq/shared/src/walletConnect/types';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';

import ServiceBase from '../ServiceBase';

import { WalletConnectDappSide } from './WalletConnectDappSide';

import type { IDBExternalAccount } from '../../dbs/local/types';
import type { ProposalTypes, SessionTypes } from '@walletconnect/types';
import type { Web3WalletTypes } from '@walletconnect/web3wallet';

@backgroundClass()
class ServiceWalletConnect extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // walletConnectChainIdChainId: eip155:1, eip155:137
  dappSide = new WalletConnectDappSide({
    backgroundApi: this.backgroundApi,
  });

  @backgroundMethod()
  @toastIfError()
  connectToWallet(
    params: IWalletConnectConnectToWalletParams,
  ): Promise<IWalletConnectSession> {
    return this.dappSide.connectToWallet(params);
  }

  @backgroundMethod()
  async activateSession({ topic }: { topic: string }) {
    await this.dappSide.activateSession({ topic });
  }

  @backgroundMethod()
  @toastIfError()
  async testExternalAccountPersonalSign({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const chainData = await this.getChainDataByNetworkId({
      networkId,
    });
    const account = await this.backgroundApi.serviceAccount.getAccount({
      accountId,
      networkId,
    });

    return this.dappSide.testExternalAccountPersonalSign({
      address: account.address,
      wcChain: chainData?.wcChain || '',
      topic:
        (account as IDBExternalAccount).connectionInfo?.walletConnect?.topic ||
        '',
      account: account as IDBExternalAccount,
    });
  }

  // chainId: eip155:1, eip155:137
  @backgroundMethod()
  async getWcChainInfo(
    walletConnectChainId?: IWalletConnectChainString,
  ): Promise<IWalletConnectChainInfo | undefined> {
    if (!walletConnectChainId || !walletConnectChainId.includes(':')) {
      throw new Error(
        `WalletConnect ChainId not valid: ${walletConnectChainId || ''}`,
      );
    }
    const [namespace, reference] = walletConnectChainId.split(':');
    const allChainsData = await this.getAllChains();
    const result = allChainsData.find(
      (chain) => chain.chainId === reference && chain.wcNamespace === namespace,
    );
    return result;
  }

  @backgroundMethod()
  async getAllChains(): Promise<IWalletConnectChainInfo[]> {
    return this._getAllChains();
  }

  _getAllChains = memoizee(
    async () => {
      const { serviceNetwork } = this.backgroundApi;
      let chainInfos: IWalletConnectChainInfo[] = [];

      for (const [networkImpl, namespace] of Object.entries(
        implToNamespaceMap,
      )) {
        const { networks } = await serviceNetwork.getNetworksByImpls({
          impls: [networkImpl],
        });
        const infos = networks.map<IWalletConnectChainInfo>((n) => {
          let caipsInfo: ICaipsInfo | undefined;
          const caipsItem = caipsToNetworkMap[namespace];
          if (caipsItem) {
            caipsInfo = caipsItem.find((caips) => caips.networkId === n.id);
          }
          const chainId = caipsInfo?.caipsChainId || n.chainId;
          return {
            chainId,
            networkId: caipsInfo?.networkId || n.id,
            wcNamespace: namespace,
            networkName: n.name,
            wcChain: `${namespace}:${chainId}`,
          };
        });
        chainInfos = chainInfos.concat(infos);
      }

      return chainInfos;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  @backgroundMethod()
  async getNetworkImplByNamespace(namespace: INamespaceUnion) {
    return Promise.resolve(namespaceToImplsMap[namespace]);
  }

  @backgroundMethod()
  async getChainDataByNetworkId({ networkId }: { networkId: string }) {
    const allChains = await this.getAllChains();
    return allChains.find((chain) => chain.networkId === networkId);
  }

  @backgroundMethod()
  async getWcChainByNetworkId({ networkId }: { networkId: string }) {
    const chainData = await this.getChainDataByNetworkId({
      networkId,
    });
    const wcChain = chainData?.wcChain;
    if (!wcChain) {
      throw new Error(
        `getWcChainByNetworkId ERROR: wcChain not found ${networkId}`,
      );
    }
    return wcChain;
  }

  // ----------------------------------------------

  @backgroundMethod()
  async getNotSupportedChains(
    namespaces:
      | IWalletConnectRequiredNamespaces
      | IWalletConnectOptionalNamespaces,
  ): Promise<string[]> {
    // Find the supported chains must
    const required = new Set<string>(); // [eip155:5]
    // Array to collect chains that are not supported
    const notSupportedChains: string[] = [];
    // const namespaces = isOptionalNamespace
    //   ? proposal.params.optionalNamespaces
    //   : proposal.params.requiredNamespaces;
    for (const [key, values] of Object.entries(namespaces)) {
      if (key.includes(':')) {
        required.add(key);
      } else {
        values.chains?.forEach((chain) => {
          if (chain.includes(':')) {
            required.add(chain);
          } else {
            // If it does not contain ':', add it directly to notSupportedChains
            notSupportedChains.push(chain);
          }
        });
      }
    }

    // Loop over each chainId and check if the chain data is supported
    for (const walletConnectChainId of Array.from(required)) {
      const isSupported = await this.getWcChainInfo(walletConnectChainId);
      if (!isSupported) {
        notSupportedChains.push(walletConnectChainId);
      }
    }

    return notSupportedChains;
  }

  @backgroundMethod()
  async checkMethodSupport(namespace: INamespaceUnion, method: string) {
    return Promise.resolve(
      (supportMethodsMap[namespace] ?? []).includes(method),
    );
  }

  @backgroundMethod()
  async getAvailableNetworkIdsForNamespace(
    requiredNamespaces: Record<string, { chains?: string[] }>,
    optionalNamespaces: Record<string, { chains?: string[] }> = {},
    namespace: string,
  ) {
    const { chains } = requiredNamespaces[namespace] || {};
    const { chains: optionalChains } = optionalNamespaces[namespace] || {};
    const networkIds = (
      await Promise.all(
        [...(chains ?? []), ...(optionalChains ?? [])].map(
          async (walletConnectChainId) =>
            this.getWcChainInfo(walletConnectChainId),
        ),
      )
    )
      .map((n) => n?.networkId)
      .filter(Boolean);
    return Array.from(new Set(networkIds));
  }

  @backgroundMethod()
  async getSessionApprovalAccountInfo(
    proposal: Web3WalletTypes.SessionProposal,
  ) {
    const { requiredNamespaces, optionalNamespaces } = proposal.params;
    const supported: Array<{
      accountSelectorNum: number;
      networkIds: string[];
      impl: string;
    }> = [];
    let index = 0;
    // Filter supported chains from requiredNamespace
    for (const namespace of Object.keys(requiredNamespaces)) {
      const impl = namespaceToImplsMap[namespace as INamespaceUnion];
      if (!impl) {
        throw new Error('Namespace not supported');
      }
      // Generate networkIds by merging supported networks from both required and optional namespaces
      const networkIds = await this.getAvailableNetworkIdsForNamespace(
        requiredNamespaces,
        optionalNamespaces,
        namespace,
      );
      supported.push({
        impl,
        accountSelectorNum: index + WalletConnectAccountSelectorNumStartAt,
        networkIds,
      });
      index += 1;
    }

    // Filter supported chains from optionalNamespace
    for (const namespace of Object.keys(optionalNamespaces)) {
      const impl = namespaceToImplsMap[namespace as INamespaceUnion];
      // Skip namespaces not supported by the wallet
      if (impl) {
        const existImpl = supported.find((s) => s.impl === impl);
        // Skip the current namespace if it has already been processed in the required list
        if (!existImpl) {
          const networkIds = await this.getAvailableNetworkIdsForNamespace(
            requiredNamespaces,
            optionalNamespaces,
            namespace,
          );
          supported.push({
            impl,
            accountSelectorNum: index + WalletConnectAccountSelectorNumStartAt,
            networkIds,
          });
          index += 1;
        }
      }
    }

    return supported;
  }

  @backgroundMethod()
  async buildWalletConnectNamespace({
    proposal,
    accountsInfo,
  }: {
    proposal: Web3WalletTypes.SessionProposal;
    accountsInfo: IConnectionAccountInfo[];
  }): Promise<Record<string, SessionTypes.BaseNamespace>> {
    const supportedNamespaces: Record<string, SessionTypes.BaseNamespace> = {};

    // Utility function to process namespaces
    const processNamespaces = async (
      namespaces: ProposalTypes.RequiredNamespaces,
      notSupportedChains: string[] = [],
    ) => {
      for (const [key, value] of Object.entries(namespaces)) {
        const namespace = key as INamespaceUnion;
        const { chains } = value;
        const impl = namespaceToImplsMap[namespace];
        const account = accountsInfo.find((a) => a.networkImpl === impl);

        const filteredChains =
          chains?.filter((chain) => !notSupportedChains.includes(chain)) ?? [];
        supportedNamespaces[namespace] = {
          chains: filteredChains,
          methods: supportMethodsMap[namespace] ?? [],
          events: supportEventsMap[namespace],
          accounts:
            filteredChains.map((c) => `${c}:${account?.address ?? ''}`) ?? [],
        };
      }
    };
    // Process required namespaces
    await processNamespaces(proposal.params.requiredNamespaces);

    // Retrieve list of unsupported optional chains
    const notSupportedChains = await this.getNotSupportedChains(
      proposal.params.optionalNamespaces,
    );

    // Process optional namespaces, considering unsupported chains
    if (proposal.params.optionalNamespaces) {
      const isEmptyRequiredNamespace =
        Object.keys(proposal.params.requiredNamespaces).length <= 0;
      const filteredOptionalNamespaces = isEmptyRequiredNamespace
        ? proposal.params.optionalNamespaces
        : Object.fromEntries(
            Object.entries(proposal.params.optionalNamespaces).filter(
              ([key]) => key in proposal.params.requiredNamespaces,
            ),
          );
      await processNamespaces(filteredOptionalNamespaces, notSupportedChains);
    }

    console.log('supportedNamespaces: ', supportedNamespaces);
    return supportedNamespaces;
  }

  @backgroundMethod()
  async getActiveSessions() {
    return this.backgroundApi.walletConnect.web3Wallet?.getActiveSessions();
  }

  @backgroundMethod()
  async disconnectAllSessions() {
    const activeSessions = await this.getActiveSessions();
    for (const session of Object.values(activeSessions ?? {})) {
      void this.walletConnectDisconnect(session.topic);
    }
  }

  @backgroundMethod()
  async walletConnectDisconnect(topic: string) {
    // emit `session_delete` event to dapp
    return this.backgroundApi.walletConnect.web3Wallet?.disconnectSession({
      topic,
      reason: getSdkError('USER_DISCONNECTED'),
    });
  }

  @backgroundMethod()
  async updateNamespaceAndSession(
    topic: string,
    accountsInfo: IConnectionAccountInfo[],
  ) {
    const activeSessions = await this.getActiveSessions();
    const session = activeSessions?.[topic];
    if (session) {
      const updatedNamespaces = { ...session.namespaces };
      for (const [namespace, value] of Object.entries(session.namespaces)) {
        const matchAccount = accountsInfo.find(
          (account) =>
            account.networkImpl ===
            namespaceToImplsMap[namespace as INamespaceUnion],
        );
        if (matchAccount) {
          updatedNamespaces[namespace] = {
            ...value,
            accounts: (value.chains ?? []).map(
              (chain) => `${chain}:${matchAccount.address}`,
            ),
          };
        }
      }
      await this.updateSession(topic, updatedNamespaces);

      // Push the first address change of each namespace to the dApp
      for (const value of Object.values(updatedNamespaces)) {
        const address = value.accounts?.[0]?.split(':')[2];
        const chainId = value.chains?.[0];
        if (address && chainId) {
          setTimeout(() => {
            void this.emitAccountsChangedEvent({
              topic,
              chainId,
              address,
            });
          }, 500);
        }
      }

      // Push network change of each namespace to the dApp
      void this.batchEmitNetworkChangedEvent({
        topic,
        accountsInfo,
      });
    }
  }

  @backgroundMethod()
  async updateSession(topic: string, namespaces: SessionTypes.Namespaces) {
    console.log('WalletConnect Update Session: ', namespaces);
    // emit `session_update` event to dapp
    return this.backgroundApi.walletConnect.web3Wallet?.updateSession({
      topic,
      namespaces,
    });
  }

  @backgroundMethod()
  async emitAccountsChangedEvent({
    topic,
    chainId,
    address,
  }: {
    topic: string;
    chainId: string;
    address: string;
  }) {
    return this.backgroundApi.walletConnect.web3Wallet?.emitSessionEvent({
      topic,
      event: {
        name: 'accountsChanged',
        data: [address],
      },
      chainId,
    });
  }

  @backgroundMethod()
  async emitNetworkChangedEvent({
    topic,
    walletConnectChainId,
    chainId,
  }: {
    topic: string;
    chainId: string;
    walletConnectChainId: string;
  }) {
    return this.backgroundApi.walletConnect.web3Wallet?.emitSessionEvent({
      topic,
      event: {
        name: 'chainChanged',
        data: chainId,
      },
      chainId: walletConnectChainId,
    });
  }

  @backgroundMethod()
  async batchEmitNetworkChangedEvent({
    topic,
    accountsInfo,
  }: {
    topic: string;
    accountsInfo: IConnectionAccountInfo[];
  }) {
    if (!topic || !accountsInfo.length) {
      return;
    }
    for (const accountInfo of accountsInfo) {
      if (accountInfo.networkId) {
        const chainData = await this.getChainDataByNetworkId({
          networkId: accountInfo.networkId,
        });
        if (chainData?.chainId && chainData?.wcNamespace) {
          void this.emitNetworkChangedEvent({
            topic,
            walletConnectChainId: `${chainData?.wcNamespace}:${chainData?.chainId}`,
            chainId: networkUtils.getNetworkChainId({
              networkId: accountInfo.networkId,
            }),
          });
        }
      }
    }
  }

  @backgroundMethod()
  async handleSessionDelete(topic: string) {
    const rawData =
      await this.backgroundApi.simpleDb.dappConnection.getRawData();
    if (rawData?.data?.walletConnect) {
      for (const [key, value] of Object.entries(rawData.data.walletConnect)) {
        if (value.walletConnectTopic === topic) {
          void this.backgroundApi.serviceDApp.disconnectWebsite({
            origin: key,
            storageType: 'walletConnect',
          });
        }
      }
    }
  }

  // dapp side methods ----------------------------------------------

  parseWalletConnectFullAddress({
    wcAddress,
  }: {
    wcAddress: IWalletConnectAddressString;
  }) {
    const [namespace, chainId, address] = wcAddress.split(':');

    const wcChain: IWalletConnectChainString = `${namespace}:${chainId}`;
    return {
      namespace,
      chainId,
      address,
      wcAddress,
      wcChain,
    };
  }

  @backgroundMethod()
  async parseWalletSessionNamespace({
    namespaces,
  }: {
    namespaces: SessionTypes.Namespaces;
  }): Promise<{
    accountsMap: {
      [networkId: string]: IWcChainAddress[];
    };
    addressMap: {
      [networkId: string]: string; // join(',')
    };
    networkIds: string[];
  }> {
    const accountsMap: {
      [networkId: string]: IWcChainAddress[];
    } = {};
    const addressMap: {
      [networkId: string]: string; // join(',')
    } = {};
    const networkIds: string[] = [];
    const entries = Object.entries(namespaces);
    for (const [, value] of entries) {
      const accounts = value?.accounts || [];
      for (const fullAddress of accounts) {
        const { address, wcChain } = this.parseWalletConnectFullAddress({
          wcAddress: fullAddress,
        });
        const chainInfo = await this.getWcChainInfo(wcChain);
        if (chainInfo) {
          const { networkIdOrImpl, isMergedNetwork } =
            accountUtils.getWalletConnectMergedNetwork({
              networkId: chainInfo.networkId,
            });

          networkIds.push(chainInfo.networkId);
          accountsMap[chainInfo.networkId] =
            accountsMap[chainInfo.networkId] || [];
          addressMap[networkIdOrImpl] = addressMap[networkIdOrImpl] || '';
          if (
            !accountsMap[chainInfo.networkId].find(
              (item) => item.address === address,
            )
          ) {
            accountsMap[chainInfo.networkId].push({
              ...chainInfo,
              address,
              wcAddress: fullAddress,
            });
            if (address) {
              const updateAddressMap = (key: string) => {
                const currentAddress = addressMap[key];
                addressMap[key] = `${currentAddress || ''}${
                  currentAddress ? ',' : ''
                }${address}`;
              };
              // always save networkId map for send tx address matched checking
              updateAddressMap(chainInfo.networkId);
              if (isMergedNetwork) {
                updateAddressMap(networkIdOrImpl);
              }
            }
          }
        }
      }
    }
    return {
      accountsMap,
      addressMap,
      networkIds: uniq(networkIds),
    };
  }
}

export default ServiceWalletConnect;
