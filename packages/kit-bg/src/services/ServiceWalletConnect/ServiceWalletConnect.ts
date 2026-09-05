import { getSdkError } from '@walletconnect/utils';
import { uniq } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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

import type { WalletKitTypes } from '@reown/walletkit';
import type { ProposalTypes, SessionTypes } from '@walletconnect/types';

// A namespace key is either a bare namespace (`eip155`) or a CAIP-2 chain that
// scopes the entry to that single chain (`eip155:1`). Both forms resolve to the
// same wallet impl, and the chain named by the key counts as a requested chain.
function parseNamespaceKey(key: string): {
  namespace: INamespaceUnion;
  impl: string | undefined;
  chainsFromKey: string[];
} {
  const namespace = key.split(':')[0] as INamespaceUnion;
  return {
    namespace,
    impl: namespaceToImplsMap[namespace],
    chainsFromKey: key.includes(':') ? [key] : [],
  };
}

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
  async abortConnectPairing({ uri }: { uri: string }) {
    const cancelled = await this.dappSide.abortConnectPairing({ uri });
    // the pairing uri query carries the symKey, never log it
    console.log(
      'abortConnectPairing current attempt: ',
      uri.split('?')[0],
      cancelled,
    );
  }

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

  // chainId: eip155:1, eip155:137
  @backgroundMethod()
  async getWcChainInfo(
    walletConnectChainId?: IWalletConnectChainString,
  ): Promise<IWalletConnectChainInfo | undefined> {
    if (!walletConnectChainId || !walletConnectChainId.includes(':')) {
      throw new OneKeyLocalError(
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
        const infos = networks.flatMap<IWalletConnectChainInfo>((n) => {
          const caipsItem = caipsToNetworkMap[namespace];
          let matchingCaipsInfos: ICaipsInfo[] = [];
          if (caipsItem) {
            matchingCaipsInfos = caipsItem.filter(
              (caips) => caips.networkId === n.id,
            );
          }

          if (matchingCaipsInfos.length === 0) {
            return [
              {
                chainId: n.chainId,
                networkId: n.id,
                wcNamespace: namespace,
                networkName: n.name,
                wcChain: `${namespace}:${n.chainId}`,
              },
            ];
          }

          return matchingCaipsInfos.map((caipsInfo) => ({
            chainId: caipsInfo.caipsChainId || n.chainId,
            networkId: caipsInfo.networkId || n.id,
            wcNamespace: namespace,
            networkName: n.name,
            wcChain: `${namespace}:${caipsInfo.caipsChainId || n.chainId}`,
          }));
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
      throw new OneKeyLocalError(
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

  // Namespace keys that would contribute nothing to the approve payload:
  // either the wallet has no impl for the namespace family, or none of the
  // chains the entry declares (via the key or `chains`) are ones the wallet
  // knows about. buildWalletConnectNamespace drops both cases from the
  // approve payload the same way, so a required one has to be rejected up
  // front -- getNotSupportedChains alone is not enough, since it flags
  // individual unsupported chains rather than an entry left with none.
  @backgroundMethod()
  async getNotSupportedNamespaces(
    namespaces:
      | IWalletConnectRequiredNamespaces
      | IWalletConnectOptionalNamespaces
      | undefined,
  ): Promise<string[]> {
    const notSupported: string[] = [];
    for (const [key, value] of Object.entries(namespaces ?? {})) {
      const { impl, chainsFromKey } = parseNamespaceKey(key);
      if (!impl) {
        notSupported.push(key);
        continue;
      }
      const entryChains = [...chainsFromKey, ...(value.chains ?? [])];
      if (entryChains.length === 0) {
        notSupported.push(key);
        continue;
      }
      // getWcChainInfo throws on a chain string without a CAIP-2 colon
      // instead of returning undefined, and `chains` is only TS-typed as
      // string[] -- the wire payload from the dApp's proposal isn't
      // validated before this point, so an entry can be a non-string too.
      // Either case must resolve to "not supported" rather than take down
      // the handler this runs in before it reaches its own try/catch.
      const chainInfos = await Promise.all(
        entryChains.map((chain) =>
          typeof chain === 'string' && chain.includes(':')
            ? this.getWcChainInfo(chain)
            : undefined,
        ),
      );
      if (chainInfos.every((info) => !info)) {
        notSupported.push(key);
      }
    }
    return notSupported;
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
    const { chainsFromKey } = parseNamespaceKey(namespace);
    const networkIds = (
      await Promise.all(
        [...chainsFromKey, ...(chains ?? []), ...(optionalChains ?? [])].map(
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
    proposal: WalletKitTypes.SessionProposal,
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
      const { impl } = parseNamespaceKey(namespace);
      if (!impl) {
        throw new OneKeyLocalError('Namespace not supported');
      }
      // Generate networkIds by merging supported networks from both required and optional namespaces
      const networkIds = await this.getAvailableNetworkIdsForNamespace(
        requiredNamespaces,
        optionalNamespaces,
        namespace,
      );
      // One selector per impl. A proposal can reach the same impl through more
      // than one key (`eip155:1` alongside `eip155:137`), and both the approve
      // payload and updateNamespaceAndSession look the account up by impl, so a
      // second selector would be filled in by the user and then never read.
      const existImpl = supported.find((s) => s.impl === impl);
      if (existImpl) {
        existImpl.networkIds = Array.from(
          new Set([...existImpl.networkIds, ...networkIds]),
        );
        continue;
      }
      supported.push({
        impl,
        accountSelectorNum: index + WalletConnectAccountSelectorNumStartAt,
        networkIds,
      });
      index += 1;
    }

    // Filter supported chains from optionalNamespace
    for (const namespace of Object.keys(optionalNamespaces)) {
      const { impl } = parseNamespaceKey(namespace);
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
    proposal: WalletKitTypes.SessionProposal;
    accountsInfo: IConnectionAccountInfo[];
  }): Promise<Record<string, SessionTypes.BaseNamespace>> {
    const supportedNamespaces: Record<string, SessionTypes.BaseNamespace> = {};

    // Utility function to process namespaces
    const processNamespaces = async (
      namespaces: ProposalTypes.RequiredNamespaces,
      notSupportedChains: string[] = [],
    ) => {
      for (const [key, value] of Object.entries(namespaces)) {
        const { namespace, impl, chainsFromKey } = parseNamespaceKey(key);
        const { chains } = value;
        // A namespace with no impl behind it cannot be served. Writing it out
        // anyway tells the dApp the wallet supports it with zero accounts, and
        // for a CAIP-2 key the empty accounts array fails the SDK's own
        // isConformingNamespaces check inside approveSession.
        if (!impl) {
          continue;
        }
        const address = accountsInfo.find(
          (a) => a.networkImpl === impl,
        )?.address;

        const filteredChains = [...chainsFromKey, ...(chains ?? [])].filter(
          (chain) => !notSupportedChains.includes(chain),
        );

        // Merge with existing chains instead of overwriting
        const existingNamespace = supportedNamespaces[key];
        const mergedChains = existingNamespace
          ? [
              ...new Set([
                ...(existingNamespace.chains || []),
                ...filteredChains,
              ]),
            ]
          : filteredChains;

        // Same reasoning: an entry whose chains were all filtered out, or that
        // has no account behind it, would be an empty namespace on the dApp
        // side rather than an absent one.
        if (mergedChains.length === 0 || !address) {
          continue;
        }

        supportedNamespaces[key] = {
          chains: mergedChains,
          methods: supportMethodsMap[namespace] ?? [],
          events: supportEventsMap[namespace] ?? [],
          accounts: mergedChains.map((c) => `${c}:${address}`),
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
    const activeSessions =
      this.backgroundApi.walletConnect.web3Wallet?.getActiveSessions();
    return activeSessions;
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
        // The settled session is keyed the same way the proposal was, so a
        // namespace key can be an inline chain. Resolving the impl straight off
        // the key would miss those and leave the entry on its old account.
        const { impl, chainsFromKey } = parseNamespaceKey(namespace);
        const matchAccount = accountsInfo.find(
          (account) => account.networkImpl === impl,
        );
        if (matchAccount) {
          const chains = value.chains?.length ? value.chains : chainsFromKey;
          updatedNamespaces[namespace] = {
            ...value,
            accounts: chains.map((chain) => `${chain}:${matchAccount.address}`),
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
                const currentAddress = addressMap?.[key] || '';
                if (currentAddress && currentAddress === address) {
                  return;
                }
                const splitter = currentAddress ? ',' : '';
                addressMap[key] = `${currentAddress}${splitter}${address}`;
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
