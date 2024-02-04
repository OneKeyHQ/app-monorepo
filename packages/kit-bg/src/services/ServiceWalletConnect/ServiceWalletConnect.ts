import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  namespaceToImplsMap,
  supportMethodsMap,
} from '@onekeyhq/shared/src/walletConnect/constant';
import type {
  IChainInfo,
  INamespaceUnion,
} from '@onekeyhq/shared/src/walletConnect/types';

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

      const supportImplsMap = {
        [IMPL_EVM]: 'eip155',
      };
      for (const [networkImpl, namespace] of Object.entries(supportImplsMap)) {
        const { networks } = await serviceNetwork.getNetworksByImpls({
          impls: [networkImpl],
        });
        const infos = networks.map((n) => ({
          chainId: n.chainId,
          namespace,
          name: n.name,
        }));
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
}

export default ServiceWalletConnect;
