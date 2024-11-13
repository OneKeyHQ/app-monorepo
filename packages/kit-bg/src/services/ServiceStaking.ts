import { isTaprootAddress } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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
  IAccountHistoryTx,
  IChangedPendingTxInfo,
} from '@onekeyhq/shared/types/history';
import type {
  IAllowanceOverview,
  IAvailableAsset,
  IBabylonPortfolioItem,
  IClaimRecordParams,
  IClaimableListResponse,
  IEarnAccountResponse,
  IEarnAccountTokenResponse,
  IEarnBabylonTrackingItem,
  IEarnEstimateAction,
  IEarnEstimateFeeResp,
  IEarnFAQList,
  IEarnInvestmentItem,
  IGetPortfolioParams,
  IStakeBaseParams,
  IStakeClaimBaseParams,
  IStakeHistoriesResponse,
  IStakeHistoryParams,
  IStakeProtocolDetails,
  IStakeProtocolListItem,
  IStakeTag,
  IStakeTx,
  IStakeTxResponse,
  IUnstakePushParams,
  IWithdrawBaseParams,
} from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import simpleDb from '../dbs/simple/simpleDb';
import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type {
  IAddEarnOrderParams,
  IEarnOrderItem,
} from '../dbs/simple/entity/SimpleDbEntityEarnOrders';

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
      (
        o,
      ): o is IAccountHistoryTx &
        Required<Pick<IAccountHistoryTx, 'stakingInfo'>> =>
        Boolean(o.stakingInfo && o.stakingInfo.tags.includes(stakeTag)),
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
    }>(`/earn/v2/stake`, {
      accountAddress: account.address,
      publicKey: stakingConfig.usePublicKey ? account.pub : undefined,
      term: params.term,
      feeRate: params.feeRate,
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
    }>(`/earn/v2/unstake`, {
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
  async babylonClaimRecord(params: IClaimRecordParams) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const acc = await vault.getAccount();
    const resp = await client.post<{
      data: IStakeTxResponse;
    }>(`/earn/v1/claim/record`, {
      accountAddress: acc.address,
      publicKey: acc.pub,
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
    }>(`/earn/v2/claim`, {
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
      data: IBabylonPortfolioItem[];
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
    const result = resp.data.data;
    return result;
  }

  _getProtocolList = memoizee(
    async (params: {
      symbol: string;
      networkId?: string;
      accountAddress?: string;
      publicKey?: string;
    }) => {
      const { symbol, accountAddress, publicKey } = params;
      const client = await this.getClient(EServiceEndpointEnum.Earn);
      const protocolListResp = await client.get<{
        data: { protocols: IStakeProtocolListItem[] };
      }>('/earn/v1/stake-protocol/list', {
        params: {
          symbol: symbol.toUpperCase(),
          accountAddress,
          publicKey,
        },
      });
      const protocols = protocolListResp.data.data.protocols;
      return protocols;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 5 }),
    },
  );

  @backgroundMethod()
  async getProtocolList(params: {
    symbol: string;
    networkId?: string;
    accountId?: string;
    indexedAccountId?: string;
    filter?: boolean;
  }) {
    const listParams: {
      symbol: string;
      networkId?: string;
      accountAddress?: string;
      publicKey?: string;
    } = { symbol: params.symbol };
    if (params.networkId && params.accountId) {
      const earnAccount = await this.getEarnAccount({
        accountId: params.accountId,
        networkId: params.networkId,
        indexedAccountId: params.indexedAccountId,
      });
      if (earnAccount) {
        listParams.networkId = earnAccount.networkId;
        listParams.accountAddress = earnAccount.accountAddress;
        if (networkUtils.isBTCNetwork(listParams.networkId)) {
          listParams.publicKey = earnAccount.account.pub;
        }
      }
    }
    let items = await this._getProtocolList(listParams);

    if (
      params.filter &&
      params.networkId &&
      !networkUtils.isAllNetwork({ networkId: params.networkId })
    ) {
      items = items.filter((o) => o.network.networkId === params.networkId);
    }

    const itemsWithEnabledStatus = await Promise.all(
      items.map(async (item) => {
        const stakingConfig = await this.getStakingConfigs({
          networkId: item.network.networkId,
          symbol: params.symbol,
          provider: item.provider.name,
        });
        const isEnabled = stakingConfig?.enabled;
        return { item, isEnabled };
      }),
    );

    const enabledItems = itemsWithEnabledStatus
      .filter(({ isEnabled }) => isEnabled)
      .map(({ item }) => item);
    return enabledItems;
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
  async getAccountAsset(
    params: {
      networkId: string;
      accountAddress: string;
      publicKey?: string;
    }[],
  ) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const response = await client.post<{
      data: IEarnAccountResponse;
    }>(`/earn/v1/account/list`, { accounts: params });
    const resp = response.data.data;
    const result: IEarnAccountTokenResponse = {
      totalFiatValue: resp.totalFiatValue,
      earnings24h: resp.earnings24h,
      accounts: [],
    };

    for (const account of params) {
      result.accounts.push({
        ...account,
        tokens:
          resp.tokens?.filter((i) => i.networkId === account.networkId) || [],
      });
    }
    return result;
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
        accountParams.map((item) => [
          `${item.networkId}-${item.accountAddress}-${item.publicKey || ''}`,
          item,
        ]),
      ).values(),
    );
    return this.getAccountAsset(uniqueAccountParams);
  }

  @backgroundMethod()
  async fetchInvestmentDetail(
    list: {
      accountAddress: string;
      networkId: string;
      publicKey?: string;
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
  async checkAmount({
    networkId,
    accountId,
    symbol,
    provider,
    action,
    amount,
  }: {
    accountId?: string;
    networkId?: string;
    symbol?: string;
    provider?: string;
    action: 'stake' | 'unstake' | 'claim';
    amount?: string;
  }) {
    if (!networkId || !accountId || !provider) {
      throw new Error('networkId or accountId or provider not found');
    }
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const account = await vault.getAccount();
    const client = await this.getRawDataClient(EServiceEndpointEnum.Earn);
    const result = await client.get<{
      code: number;
      message: string;
    }>(`/earn/v1/check-amount`, {
      params: {
        networkId,
        accountAddress: account.address,
        symbol,
        provider: provider || '',
        action,
        amount,
      },
    });
    const { code, message } = result.data;
    return Number(code) === 0 ? '' : message;
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
      return null;
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
          config.tokenAddress.toLowerCase() === normalizedTokenAddress &&
          config.enabled,
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
    if (!accountId && !indexedAccountId) {
      return null;
    }
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

  @backgroundMethod()
  async getFAQList(params: { provider: string; symbol: string }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: {
        list: IEarnFAQList;
      };
    }>(`/earn/v1/faq/list`, {
      params,
    });
    return resp.data.data.list;
  }

  @backgroundMethod()
  async buildEarnTx({
    accountId,
    networkId,
    tx,
  }: {
    accountId: string;
    networkId: string;
    tx: IStakeTx;
  }) {
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const encodedTx = await vault.buildStakeEncodedTx(tx as any);
    return encodedTx;
  }

  @backgroundMethod()
  async estimateFee(params: {
    networkId: string;
    provider: string;
    symbol: string;
    action: IEarnEstimateAction;
    amount: string;
    txId?: string;
  }) {
    const { symbol, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: IEarnEstimateFeeResp;
    }>(`/earn/v1/estimate-fee`, {
      params: {
        symbol: symbol.toUpperCase(),
        ...rest,
      },
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async addBabylonTrackingItem(item: IEarnBabylonTrackingItem) {
    return simpleDb.babylonSync.addTrackingItem(item);
  }

  @backgroundMethod()
  async getBabylonTrackingItems({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const items = await simpleDb.babylonSync.getTrackingList();
    const result = items.filter(
      (o) => o.accountId === accountId && networkId === o.networkId,
    );
    return result;
  }

  @backgroundMethod()
  async removeBabylonTrackingItem(item: { txIds: string[] }) {
    return simpleDb.babylonSync.removeTrackingItem({ txIds: item.txIds });
  }

  @backgroundMethod()
  async getPendingActivationPortfolioList({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<IBabylonPortfolioItem[]> {
    const trackingItems = await this.getBabylonTrackingItems({
      accountId,
      networkId,
    });
    const pendingActivationItems = trackingItems.filter(
      (o) => o.action === 'stake',
    );
    return pendingActivationItems.map((o) => {
      const item = {
        txId: '',
        status: 'local_pending_activation',
        amount: o.amount,
        fiatValue: '',
        lockBlocks: 0,
        isOverflow: '',
      } as IBabylonPortfolioItem;
      if (o.minStakeTerm && o.createAt) {
        item.startTime = o.createAt;
        item.endTime = o.createAt + o.minStakeTerm;
      }
      return item;
    });
  }

  @backgroundMethod()
  async addEarnOrder(order: IAddEarnOrderParams) {
    defaultLogger.staking.order.addOrder(order);
    return simpleDb.earnOrders.addOrder(order);
  }

  @backgroundMethod()
  async updateEarnOrder({ txs }: { txs: IChangedPendingTxInfo[] }) {
    for (const tx of txs) {
      try {
        const order =
          await this.backgroundApi.simpleDb.earnOrders.getOrderByTxId(tx.txId);
        if (order && tx.status !== EDecodedTxStatus.Pending) {
          order.status = tx.status;
          await this.updateEarnOrderStatusToServer({ order });
          await this.backgroundApi.simpleDb.earnOrders.updateOrderStatusByTxId({
            currentTxId: tx.txId,
            status: tx.status,
          });
          defaultLogger.staking.order.updateOrderStatus({
            txId: tx.txId,
            status: tx.status,
          });
        }
      } catch (e) {
        // ignore error, continue loop
        defaultLogger.staking.order.updateOrderStatusError({
          txId: tx.txId,
          status: tx.status,
        });
      }
    }
  }

  @backgroundMethod()
  async updateEarnOrderStatusToServer({ order }: { order: IEarnOrderItem }) {
    const maxRetries = 3;
    let lastError;

    for (let i = 0; i < maxRetries; i += 1) {
      try {
        const client = await this.getClient(EServiceEndpointEnum.Earn);
        await client.post('/earn/v1/orders', {
          orderId: order.orderId,
          networkId: order.networkId,
          txId: order.txId,
        });
        return; // Return early on success
      } catch (error) {
        lastError = error;
        if (i === maxRetries - 1) break; // Exit loop on final retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))); // 1s, 2s, 3s
      }
    }

    throw lastError; // Throw last error after all retries fail
  }

  @backgroundMethod()
  async updateOrderStatusByTxId(params: {
    currentTxId: string;
    newTxId?: string;
    status: EDecodedTxStatus;
  }) {
    defaultLogger.staking.order.updateOrderStatusByTxId(params);
    await this.backgroundApi.simpleDb.earnOrders.updateOrderStatusByTxId(
      params,
    );
  }
}

export default ServiceStaking;
