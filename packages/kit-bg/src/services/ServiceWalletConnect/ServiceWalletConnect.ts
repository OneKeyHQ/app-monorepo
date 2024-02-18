import { getSdkError } from '@walletconnect/utils';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
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

import type { ProposalTypes, SessionTypes } from '@walletconnect/types';
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
          const caipsItem = caipsToNetworkMap[namespace];
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
    isOptionalNamespace?: boolean,
  ): Promise<string[]> {
    // Find the supported chains must
    const required = []; // [eip155:5]
    const namespaces = isOptionalNamespace
      ? proposal.params.optionalNamespaces
      : proposal.params.requiredNamespaces;
    for (const [key, values] of Object.entries(namespaces)) {
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
        supportedNamespaces[namespace] = {
          chains:
            chains?.filter((chain) => !notSupportedChains.includes(chain)) ??
            [],
          methods: supportMethodsMap[namespace] ?? [],
          events: supportEventsMap[namespace],
          accounts:
            chains
              ?.filter((chain) => !notSupportedChains.includes(chain))
              .map((c) => `${c}:${account?.address ?? ''}`) ?? [],
        };
      }
    };
    // Process required namespaces
    await processNamespaces(proposal.params.requiredNamespaces);

    // Retrieve list of unsupported chains
    const notSupportedChains = await this.getNotSupportedChains(proposal, true);

    // Process optional namespaces, considering unsupported chains
    if (proposal.params.optionalNamespaces) {
      const filteredOptionalNamespaces = Object.entries(
        proposal.params.optionalNamespaces,
      )
        .filter(([key]) => key in proposal.params.requiredNamespaces)
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
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
      await this.walletConnectDisconnect(session.topic);
    }
  }

  @backgroundMethod()
  async walletConnectDisconnect(topic: string) {
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
    }
  }

  @backgroundMethod()
  async updateSession(topic: string, namespaces: SessionTypes.Namespaces) {
    console.log('WalletConnect Update Session: ', namespaces);
    return this.backgroundApi.walletConnect.web3Wallet?.updateSession({
      topic,
      namespaces,
    });
  }

  @backgroundMethod()
  async handleSessionDelete(topic: string) {
    const rawData =
      await this.backgroundApi.simpleDb.dappConnection.getRawData();
    if (rawData?.data?.walletConnect) {
      for (const [key, value] of Object.entries(rawData.data.walletConnect)) {
        if (value.walletConnectTopic === topic) {
          await this.backgroundApi.serviceDApp.disconnectWebsite({
            origin: key,
            storageType: 'walletConnect',
          });
        }
      }
    }
  }
}

export default ServiceWalletConnect;
