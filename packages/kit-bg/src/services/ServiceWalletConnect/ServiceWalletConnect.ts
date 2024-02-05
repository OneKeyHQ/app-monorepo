import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM, IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  WalletConnectStartAccountSelectorNumber,
  caipsToNetworkMap,
  implToNamespaceMap,
  namespaceToImplsMap,
  supportEventsMap,
  supportMethodsMap,
} from '@onekeyhq/shared/src/walletConnect/constant';
import type {
  ICaipsInfo,
  IChainInfo,
  INamespaceUnion,
} from '@onekeyhq/shared/src/walletConnect/types';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';

import ServiceBase from '../ServiceBase';

import type { Web3WalletTypes } from '@walletconnect/web3wallet';

@backgroundClass()
class ServiceWalletConnect extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async sampleMethod() {
    console.log('sampleMethod');
    return 'sampleMethod';
  }

  // Example of chainId: eip155:1
  @backgroundMethod()
  async getChainData(chainId?: string): Promise<IChainInfo | undefined> {
    // ignore
    if (!chainId) return;
    const [namespace, reference] = chainId.toString().split(':');
    const allChainsData = await this.getAllChains();
    return allChainsData.find(
      (chain) => chain.chainId === reference && chain.namespace === namespace,
    );
  }

  @backgroundMethod()
  async getAllChains(): Promise<IChainInfo[]> {
    return this._getAllChains();
  }

  _getAllChains = memoizee(
    async () => {
      const { serviceNetwork } = this.backgroundApi;
      let chainInfos: IChainInfo[] = [];

      for (const [networkImpl, namespace] of Object.entries(
        implToNamespaceMap,
      )) {
        const { networks } = await serviceNetwork.getNetworksByImpls({
          impls: [networkImpl],
        });
        const infos = networks.map((n) => {
          let caipsInfo: ICaipsInfo | undefined;
          const caipsItem = caipsToNetworkMap.polkadot;
          if (caipsItem) {
            caipsInfo = caipsItem.find((caips) => caips.networkId === n.id);
          }
          return {
            chainId: caipsInfo?.caipsChainId || n.chainId,
            networkId: caipsInfo?.networkId || n.id,
            namespace,
            name: n.name,
          };
        });
        chainInfos = chainInfos.concat(infos as IChainInfo[]);
      }

      return chainInfos;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  @backgroundMethod()
  async getNotSupportedChains(
    proposal: Web3WalletTypes.SessionProposal,
  ): Promise<string[]> {
    // Find the supported chains must
    const required = []; // [eip155:5]
    for (const [key, values] of Object.entries(
      proposal.params.requiredNamespaces,
    )) {
      const chains = key.includes(':') ? [key] : values.chains ?? [];
      required.push(...chains);
    }

    // Array to collect chains that are not supported
    const notSupportedChains: string[] = [];

    // Loop over each chainId and check if the chain data is supported
    for (const chainId of required) {
      const isSupported = await this.getChainData(chainId);
      if (!isSupported) {
        notSupportedChains.push(chainId);
      }
    }

    return notSupportedChains;
  }

  @backgroundMethod()
  async getNetworkImplByNamespace(namespace: INamespaceUnion) {
    return Promise.resolve(namespaceToImplsMap[namespace]);
  }

  @backgroundMethod()
  async checkMethodSupport(namespace: INamespaceUnion, method: string) {
    return Promise.resolve(
      (supportMethodsMap[namespace] ?? []).includes(method),
    );
  }

  @backgroundMethod()
  async getSessionApprovalAccountInfo(
    proposal: Web3WalletTypes.SessionProposal,
  ) {
    const { requiredNamespaces } = proposal.params;
    const promises = Object.keys(requiredNamespaces).map(
      async (namespace, index) => {
        const { chains } = requiredNamespaces[namespace];
        const networkIds = (
          await Promise.all(
            (chains ?? []).map(async (chainId) => this.getChainData(chainId)),
          )
        ).map((n) => n?.networkId);
        return {
          accountSelectorNum: index + WalletConnectStartAccountSelectorNumber,
          networkIds: networkIds.filter(Boolean),
        };
      },
    );
    return Promise.all(promises);
  }

  @backgroundMethod()
  async buildWalletConnectNamespace({
    proposal,
    accountsInfo,
  }: {
    proposal: Web3WalletTypes.SessionProposal;
    accountsInfo: IConnectionAccountInfo[];
  }) {
    const supportedNamespaces: Record<
      string,
      {
        chains: string[];
        methods: string[];
        events: string[];
        accounts: string[];
      }
    > = {};
    Object.entries(proposal.params.requiredNamespaces).forEach(
      ([key, value]) => {
        const namespace = key as INamespaceUnion;
        const { chains } = value;
        const impl = namespaceToImplsMap[namespace];
        const account = accountsInfo.find((a) => a.networkImpl === impl);
        supportedNamespaces[namespace] = {
          chains: chains ?? [],
          methods: supportMethodsMap[namespace] ?? [],
          events: supportEventsMap[namespace],
          accounts: (chains ?? []).map((c) => `${c}:${account?.address ?? ''}`),
        };
      },
    );
    console.log('supportedNamespaces: ', supportedNamespaces);
    return supportedNamespaces;
  }
}

export default ServiceWalletConnect;
