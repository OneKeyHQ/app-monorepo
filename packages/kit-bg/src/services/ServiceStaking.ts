import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  EEarnProviderEnum,
  ISupportedSymbol,
} from '@onekeyhq/shared/types/earn';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IAllowanceOverview,
  IAprItem,
  IAprToken,
  IAvailableAsset,
  IEarnAccount,
  ILidoEthOverview,
  ILidoHistoryItem,
  ILidoMaticOverview,
  IServerEvmTransaction,
  IStakeBaseParams,
  IStakeClaimBaseParams,
  IStakeHistoriesResponse,
  IStakeHistoryParams,
  IStakeProtocolDetails,
  IStakeProtocolListItem,
  IStakeTag,
  IStakeTxResponse,
} from '@onekeyhq/shared/types/staking';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceStaking extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private baseGetApr = memoizee(
    async (token: IAprToken) => {
      const client = await this.getClient(EServiceEndpointEnum.Earn);
      const resp = await client.get<{
        data: IAprItem[];
      }>(`/earn/v1/apr/index`, { params: { token } });
      return resp.data.data;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  @backgroundMethod()
  async getApr(token: IAprToken): Promise<IAprItem[]> {
    return this.baseGetApr(token);
  }

  @backgroundMethod()
  public async fetchLidoEthOverview({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<ILidoEthOverview> {
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: ILidoEthOverview;
    }>(`/earn/v1/lido-eth/overview`, { params: { accountAddress, networkId } });
    return resp.data.data;
  }

  @backgroundMethod()
  public async getLidoEthHistory({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: ILidoHistoryItem[];
    }>(`/earn/v1/lido-eth/history`, { params: { accountAddress, networkId } });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoEthStakingTransaction({
    amount,
    networkId,
  }: {
    amount: string;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-eth/tx/stake`, { amount, networkId });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoEthPermitMessage({
    amount,
    accountId,
    networkId,
  }: {
    amount: string;
    accountId: string;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const resp = await client.post<{
      data: { message: string; deadline: number };
    }>(`/earn/v1/lido-eth/tx/permit`, { amount, accountAddress, networkId });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoEthWithdrawalTransaction({
    amount,
    deadline,
    signature,
    networkId,
    accountId,
  }: {
    amount: string;
    deadline: number;
    signature: string;
    accountId: string;
    networkId: string;
  }) {
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-eth/tx/withdrawal`, {
      amount,
      deadline,
      signature,
      accountAddress,
      networkId,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoEthClaimTransaction({
    requestIds,
    networkId,
  }: {
    requestIds: number[];
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-eth/tx/claim`, { requestIds, networkId });
    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchLidoMaticOverview({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<ILidoMaticOverview> {
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: ILidoMaticOverview;
    }>(`/earn/v1/lido-matic/overview`, {
      params: { accountAddress, networkId },
    });
    return resp.data.data;
  }

  @backgroundMethod()
  public async getLidoMaticHistory({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: ILidoHistoryItem[];
    }>(`/earn/v1/lido-matic/history`, {
      params: { accountAddress, networkId },
    });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoMaticStakingTransaction({
    amount,
    networkId,
  }: {
    amount: string;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-matic/tx/stake`, { amount, networkId });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoMaticWithdrawalTransaction({
    amount,
    networkId,
  }: {
    amount: string;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-matic/tx/unstake`, { amount, networkId });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoMaticClaimTransaction({
    tokenId,
    networkId,
  }: {
    tokenId: number;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-matic/tx/claim`, { tokenId, networkId });
    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchTokenAllowance(params: {
    networkId: string;
    accountId: string;
    tokenAddress: string;
    spenderAddress: string;
    blockNumber?: number;
  }) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });

    const resp = await client.get<{
      data: IAllowanceOverview;
    }>(`/earn/v1/on-chain/allowance`, {
      params: { accountAddress, networkId, ...rest },
    });

    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchLocalStakingHistory({
    accountId,
    networkId,
    stakeTag,
  }: {
    accountId: string;
    networkId: string;
    stakeTag: IStakeTag;
  }) {
    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
    ]);

    const pendingTxs =
      await this.backgroundApi.serviceHistory.getAccountLocalHistoryPendingTxs({
        networkId,
        accountAddress,
        xpub,
      });
    const stakingTxs = pendingTxs.filter(
      (o) => o.stakingInfo && o.stakingInfo.tags.includes(stakeTag),
    );
    return stakingTxs;
  }

  @backgroundMethod()
  public async buildLidoEthPermitMessageData({
    amount,
    accountId,
    networkId,
  }: {
    amount: string;
    accountId: string;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const resp = await client.post<{
      data: { message: string; deadline: number };
    }>(`/earn/v1/lido-eth/tx/permit_message`, {
      amount,
      accountAddress,
      networkId,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async buildStakeTransaction(
    params: IStakeBaseParams,
  ): Promise<IStakeTxResponse> {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const acc = await vault.getAccount();
    const resp = await client.post<{
      data: IStakeTxResponse;
    }>(`/earn/v1/stake`, {
      accountAddress: acc.address,
      publicKey: acc.pub,
      networkId,
      ...rest,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async buildUnstakeTransaction(params: IStakeBaseParams) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });

    const resp = await client.post<{
      data: IEncodedTx;
    }>(`/earn/v1/unstake`, { accountAddress, networkId, ...rest });
    return resp.data.data;
  }

  @backgroundMethod()
  async buildClaimTransaction(params: IStakeClaimBaseParams) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });

    const resp = await client.post<{
      data: IEncodedTx;
    }>(`/earn/v1/claim`, { accountAddress, networkId, ...rest });
    return resp.data.data;
  }

  @backgroundMethod()
  async getStakeHistory(params: IStakeHistoryParams) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });

    const resp = await client.post<{
      data: IStakeHistoriesResponse;
    }>(`/earn/v1/stake-histories`, { accountAddress, networkId, ...rest });
    return resp.data.data;
  }

  @backgroundMethod()
  async getProtocolDetails(params: {
    accountId: string;
    networkId: string;
    symbol: string;
    provider: string;
  }) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const resp = await client.get<{ data: IStakeProtocolDetails }>(
      '/earn/v1/stake-protocol/detail',
      { params: { accountAddress, networkId, ...rest } },
    );
    return resp.data.data;
  }

  @backgroundMethod()
  async getProtocolList(params: {
    networkId: string;
    accountId: string;
    symbol: string;
  }) {
    const { networkId, accountId, symbol } = params;
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const protocolListResp = await client.get<{
      data: { protocols: IStakeProtocolListItem[] };
    }>('/earn/v1/stake-protocol/list', {
      params: { accountAddress, symbol: symbol.toUpperCase() },
    });
    let protocols = protocolListResp.data.data.protocols;
    protocols = protocols.filter((o) => o.network.networkId === networkId);
    return protocols;
  }

  @backgroundMethod()
  async getAccount(params: { networkId: string; accountAddress: string }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: IEarnAccount;
    }>(`/earn/v1/get-account`, { params });
    return resp.data.data;
  }

  @backgroundMethod()
  async getAllNetworkAccount({
    assets,
    indexedAccountId,
  }: {
    indexedAccountId: string;
    assets: IAvailableAsset[];
  }) {
    const dbAccounts =
      await this.backgroundApi.serviceAccount.getAccountsInSameIndexedAccountId(
        { indexedAccountId },
      );
    const accountParams: { networkId: string; accountAddress: string }[] = [];
    for (let index = 0; index < dbAccounts.length; index += 1) {
      const account = dbAccounts[index];
      assets.forEach((asset) => {
        asset.networks.forEach((network) => {
          if (network.networkId.startsWith(account.impl)) {
            accountParams.push({
              accountAddress: account.address,
              networkId: network.networkId,
            });
          }
        });
      });
    }
    const resp = await Promise.allSettled(
      accountParams.map((params) => this.getAccount(params)),
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return resp.filter((v) => v.status === 'fulfilled').map((i) => i.value);
  }

  @backgroundMethod()
  async getAvailableAssets() {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: {
        assets: IAvailableAsset[];
      };
    }>(`/earn/v1/available-assets`);
    return resp.data.data.assets;
  }

  @backgroundMethod()
  async getStakingConfigs({
    networkId,
    symbol,
    provider,
  }: {
    networkId: string;
    symbol: ISupportedSymbol;
    provider: EEarnProviderEnum;
  }) {
    const vaultSettings =
      await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });
    const allStakingConfig = vaultSettings.stakingConfig;
    if (!allStakingConfig) {
      return null;
    }

    const stakingConfig = allStakingConfig[networkId];
    if (!stakingConfig) {
      return null;
    }

    const providerConfig = stakingConfig.providers[provider];
    if (!providerConfig) {
      return null;
    }

    if (providerConfig.supportedSymbols.includes(symbol)) {
      return providerConfig.configs[symbol];
    }

    return null;
  }

  @backgroundMethod()
  async findSymbolByTokenAddress({
    networkId,
    tokenAddress,
  }: {
    networkId: string;
    tokenAddress: string;
  }) {
    const vaultSettings =
      await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });

    const allStakingConfig = vaultSettings.stakingConfig;
    if (!allStakingConfig) {
      return null;
    }

    const stakingConfig = allStakingConfig[networkId];
    if (!stakingConfig) {
      return null;
    }

    const normalizedTokenAddress = tokenAddress.toLowerCase();

    const providerEntries = Object.entries(stakingConfig.providers).filter(
      ([, providerConfig]) => providerConfig !== undefined,
    );

    for (const [provider, providerConfig] of providerEntries) {
      const symbolEntry = Object.entries(providerConfig.configs).find(
        ([, config]) =>
          config &&
          config.tokenAddress.toLowerCase() === normalizedTokenAddress,
      );

      if (symbolEntry) {
        const [symbol] = symbolEntry;
        return {
          symbol: symbol as ISupportedSymbol,
          provider: provider as EEarnProviderEnum,
        };
      }
    }

    return null;
  }
}

export default ServiceStaking;
