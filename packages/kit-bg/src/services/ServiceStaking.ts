import { isTaprootAddress } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  EEarnProviderEnum,
  ISupportedSymbol,
} from '@onekeyhq/shared/types/earn';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IAllowanceOverview,
  IAvailableAsset,
  IClaimableListResponse,
  IEarnAccountResponse,
  IEarnInvestmentItem,
  IGetPortfolioParams,
  IPortfolioItem,
  IStakeBaseParams,
  IStakeClaimBaseParams,
  IStakeHistoriesResponse,
  IStakeHistoryParams,
  IStakeProtocolDetails,
  IStakeProtocolListItem,
  IStakeTag,
  IStakeTxResponse,
  IUnstakePushParams,
  IWithdrawBaseParams,
} from '@onekeyhq/shared/types/staking';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceStaking extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
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
    const { networkId, accountId, provider, symbol, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const account = await vault.getAccount();
    const stakingConfig = await this.getStakingConfigs({
      networkId,
      symbol,
      provider,
    });
    if (!stakingConfig) {
      throw new Error('Staking config not found');
    }
    const resp = await client.post<{
      data: IStakeTxResponse;
    }>(`/earn/v1/stake`, {
      accountAddress: account.address,
      publicKey: stakingConfig.usePublicKey ? account.pub : undefined,
      term: params.term,
      networkId,
      symbol,
      provider,
      ...rest,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async buildUnstakeTransaction(params: IWithdrawBaseParams) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const account = await vault.getAccount();
    const stakingConfig = await this.getStakingConfigs({
      networkId,
      symbol: params.symbol,
      provider: params.provider,
    });
    if (!stakingConfig) {
      throw new Error('Staking config not found');
    }
    const resp = await client.post<{
      data: IStakeTxResponse;
    }>(`/earn/v1/unstake`, {
      accountAddress: account.address,
      networkId,
      publicKey: stakingConfig.usePublicKey ? account.pub : undefined,
      ...rest,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async unstakePush(params: IUnstakePushParams) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const acc = await vault.getAccount();
    const resp = await client.post<{
      data: IStakeTxResponse;
    }>(`/earn/v1/unstake/push`, {
      accountAddress: acc.address,
      networkId,
      ...rest,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async buildClaimTransaction(params: IStakeClaimBaseParams) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const account = await vault.getAccount();
    const stakingConfig = await this.getStakingConfigs({
      networkId,
      symbol: params.symbol,
      provider: params.provider,
    });
    if (!stakingConfig) {
      throw new Error('Staking config not found');
    }

    const resp = await client.post<{
      data: IStakeTxResponse;
    }>(`/earn/v1/claim`, {
      accountAddress: account.address,
      networkId,
      publicKey: stakingConfig.usePublicKey ? account.pub : undefined,
      ...rest,
    });
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

    const resp = await client.get<{
      data: IStakeHistoriesResponse;
    }>(`/earn/v1/stake-histories`, {
      params: {
        accountAddress,
        networkId,
        ...rest,
      },
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async getPortfolioList(params: IGetPortfolioParams) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const acc = await vault.getAccount();

    const resp = await client.get<{
      data: IPortfolioItem[];
    }>(`/earn/v1/portfolio/list`, {
      params: {
        accountAddress: acc.address,
        networkId,
        publicKey: networkUtils.isBTCNetwork(networkId) ? acc.pub : undefined,
        ...rest,
      },
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async getProtocolDetails(params: {
    accountId?: string;
    indexedAccountId?: string;
    networkId: string;
    symbol: string;
    provider: string;
  }) {
    const { networkId, accountId, indexedAccountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const requestParams: {
      accountAddress?: string;
      networkId: string;
      symbol: string;
      provider: string;
      publicKey?: string;
    } = { networkId, ...rest };
    const account = await this.getEarnAccount({
      accountId: accountId ?? '',
      networkId,
      indexedAccountId,
    });
    if (account?.accountAddress) {
      requestParams.accountAddress = account.accountAddress;
    }
    if (account?.account?.pub) {
      requestParams.publicKey = account?.account?.pub;
    }
    const resp = await client.get<{ data: IStakeProtocolDetails }>(
      '/earn/v1/stake-protocol/detail',
      { params: requestParams },
    );
    return resp.data.data;
  }

  _getProtocolList = memoizee(
    async (params: { networkId?: string; symbol: string }) => {
      const { symbol } = params;
      const client = await this.getClient(EServiceEndpointEnum.Earn);
      const protocolListResp = await client.get<{
        data: { protocols: IStakeProtocolListItem[] };
      }>('/earn/v1/stake-protocol/list', {
        params: {
          symbol: symbol.toUpperCase(),
        },
      });
      const protocols = protocolListResp.data.data.protocols;
      return protocols;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  @backgroundMethod()
  async getProtocolList(params: {
    networkId?: string;
    symbol: string;
    filter?: boolean;
  }) {
    let items = await this._getProtocolList(params);
    if (params.filter && params.networkId) {
      items = items.filter((o) => o.network.networkId === params.networkId);
    }
    return items;
  }

  @backgroundMethod()
  async getClaimableList(params: {
    networkId: string;
    accountId: string;
    symbol: string;
    provider: string;
  }) {
    const { networkId, accountId, symbol, ...rest } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const acc = await vault.getAccount();
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: IClaimableListResponse;
    }>('/earn/v1/claimable/list', {
      params: {
        networkId,
        accountAddress: acc.address,
        symbol: symbol.toUpperCase(),
        publicKey: networkUtils.isBTCNetwork(networkId) ? acc.pub : undefined,
        ...rest,
      },
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async getWithdrawList(params: {
    networkId: string;
    accountId: string;
    symbol: string;
    provider: string;
  }) {
    const { networkId, accountId, symbol, ...rest } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const acc = await vault.getAccount();

    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: IClaimableListResponse;
    }>('/earn/v1/withdraw/list', {
      params: {
        networkId,
        accountAddress: acc.address,
        symbol: symbol.toUpperCase(),
        publicKey: networkUtils.isBTCNetwork(networkId) ? acc.pub : undefined,
        ...rest,
      },
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async getAccountAsset(params: {
    networkId: string;
    accountAddress: string;
    publicKey?: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: IEarnAccountResponse;
    }>(`/earn/v1/get-account`, { params });
    return {
      ...params,
      earn: resp.data.data,
    };
  }

  @backgroundMethod()
  async fetchAllNetworkAssets({
    accountId,
    networkId,
    assets,
  }: {
    accountId: string;
    networkId: string;
    assets: IAvailableAsset[];
  }) {
    const accounts = await this.getEarnAvailableAccounts({
      accountId,
      networkId,
    });
    const accountParams: {
      networkId: string;
      accountAddress: string;
      publicKey?: string;
    }[] = [];

    assets.forEach((asset) => {
      const account = accounts.find((i) => i.networkId === asset.networkId);
      if (account?.apiAddress) {
        accountParams.push({
          accountAddress: account?.apiAddress,
          networkId: asset.networkId,
          publicKey: account?.pub,
        });
      }
    });

    const uniqueAccountParams = Array.from(
      new Map(
        accountParams.map((item) => [JSON.stringify(item), item]),
      ).values(),
    );

    const resp = await Promise.allSettled(
      uniqueAccountParams.map((params) => this.getAccountAsset(params)),
    );
    return (
      resp.filter((v) => v.status === 'fulfilled') as {
        value: {
          earn: IEarnAccountResponse;
          networkId: string;
          accountAddress: string;
          publicKey?: string;
        };
      }[]
    ).map((i) => i.value);
  }

  @backgroundMethod()
  async fetchInvestmentDetail(
    list: {
      accountAddress: string;
      networkId: string;
    }[],
  ) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const response = await client.post<{
      data: IEarnInvestmentItem[];
    }>(`/earn/v1/investment/detail`, {
      list,
    });
    return response.data.data;
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
    symbol: string;
    provider: string;
  }) {
    const providerKey = earnUtils.getEarnProviderEnumKey(provider);
    if (!providerKey) {
      throw new Error('Invalid provider');
    }

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

    const providerConfig = stakingConfig.providers[providerKey];
    if (!providerConfig) {
      return null;
    }

    if (providerConfig.supportedSymbols.includes(symbol as ISupportedSymbol)) {
      return providerConfig.configs[symbol as ISupportedSymbol];
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

  @backgroundMethod()
  async getEarnAccount(params: {
    accountId: string;
    networkId: string;
    indexedAccountId?: string;
  }) {
    const { accountId, networkId, indexedAccountId } = params;
    if (networkUtils.isAllNetwork({ networkId })) {
      throw new Error('networkId should not be all network');
    }
    if (networkUtils.isAllNetwork({ networkId }) && !indexedAccountId) {
      throw new Error('indexedAccountId should be provided');
    }
    if (accountUtils.isOthersAccount({ accountId }) || !indexedAccountId) {
      let account: INetworkAccount | null = null;
      try {
        account = await this.backgroundApi.serviceAccount.getAccount({
          accountId,
          networkId,
        });
      } catch (e) {
        return null;
      }
      if (
        networkUtils.isBTCNetwork(networkId) &&
        !isTaprootAddress(account?.address)
      ) {
        return null;
      }
      const accountAddress =
        await this.backgroundApi.serviceAccount.getAccountAddressForApi({
          networkId,
          accountId,
        });
      return {
        accountId: account.id,
        networkId,
        accountAddress,
        account,
      };
    }
    try {
      const globalDeriveType =
        await this.backgroundApi.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        });
      let deriveType = globalDeriveType;
      // only support taproot for earn
      if (networkUtils.isBTCNetwork(networkId)) {
        deriveType = 'BIP86';
      }
      const networkAccount =
        await this.backgroundApi.serviceAccount.getNetworkAccount({
          accountId: undefined,
          indexedAccountId,
          networkId,
          deriveType,
        });
      const accountAddress =
        await this.backgroundApi.serviceAccount.getAccountAddressForApi({
          networkId,
          accountId: networkAccount.id,
        });
      return {
        accountId: networkAccount.id,
        networkId,
        accountAddress,
        account: networkAccount,
      };
    } catch (e) {
      // ignore error
      return null;
    }
  }

  @backgroundMethod()
  async getEarnAvailableAccounts(params: {
    accountId: string;
    networkId: string;
  }) {
    const { accountId, networkId } = params;
    const { accountsInfo } =
      await this.backgroundApi.serviceAllNetwork.getAllNetworkAccounts({
        accountId,
        networkId,
        fetchAllNetworkAccounts: accountUtils.isOthersAccount({ accountId })
          ? undefined
          : true,
      });
    return accountsInfo.filter(
      (account) =>
        !(
          networkUtils.isBTCNetwork(account.networkId) &&
          !isTaprootAddress(account.apiAddress)
        ),
    );
  }
}

export default ServiceStaking;
