import BigNumber from 'bignumber.js';
import { debounce, isNil, uniq } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  getListedNetworkMap,
  getNetworkIdsMap,
} from '@onekeyhq/shared/src/config/networkIds';
import { AGGREGATE_TOKEN_MOCK_NETWORK_ID } from '@onekeyhq/shared/src/consts/networkConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  buildAggregateTokenListData,
  buildAggregateTokenListMapKeyForTokenList,
  buildAggregateTokenMapKeyForAggregateConfig,
  buildHomeDefaultTokenMapKey,
  getEmptyTokenData,
  getMergedTokenData,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IAccountToken,
  IAggregateToken,
  IFetchAccountTokensParams,
  IFetchAccountTokensResp,
  IFetchAggregateTokenConfigMapResp,
  IFetchTokenDetailItem,
  IFetchTokenDetailParams,
  IHomeDefaultToken,
  ISearchTokensParams,
  IToken,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { vaultFactory } from '../vaults/factory';
import { getVaultSettings } from '../vaults/settings';

import ServiceBase from './ServiceBase';

import type { IDBAccount } from '../dbs/local/types';
import type { ISimpleDBLocalTokens } from '../dbs/simple/entity/SimpleDbEntityLocalTokens';
import type { IRiskTokenManagementDBStruct } from '../dbs/simple/entity/SimpleDbEntityRiskTokenManagement';

@backgroundClass()
class ServiceToken extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _fetchAccountTokensControllers: AbortController[] = [];

  _searchTokensControllers: AbortController[] = [];

  _fetchAggregateTokenMapControllers: AbortController[] = [];

  @backgroundMethod()
  public async abortSearchTokens() {
    this._searchTokensControllers.forEach((controller) => controller.abort());
    this._searchTokensControllers = [];
  }

  @backgroundMethod()
  public async abortFetchAggregateTokenMap() {
    this._fetchAggregateTokenMapControllers.forEach((controller) =>
      controller.abort(),
    );
    this._fetchAggregateTokenMapControllers = [];
  }

  @backgroundMethod()
  public async abortFetchAccountTokens() {
    this._fetchAccountTokensControllers.forEach((controller) =>
      controller.abort(),
    );
    this._fetchAccountTokensControllers = [];
  }

  localAccountTokensCache: {
    tokenList: Record<string, IAccountToken[]>;
    smallBalanceTokenList: Record<string, IAccountToken[]>;
    riskyTokenList: Record<string, IAccountToken[]>;
    tokenListValue: Record<string, string>;
    tokenListMap: Record<string, Record<string, ITokenFiat>>;
  } = {
    tokenList: {},
    smallBalanceTokenList: {},
    riskyTokenList: {},
    tokenListValue: {},
    tokenListMap: {},
  };

  @backgroundMethod()
  public async fetchAccountTokens(
    params: IFetchAccountTokensParams & {
      mergeTokens?: boolean;
      dbAccount?: IDBAccount;
    },
  ): Promise<IFetchAccountTokensResp> {
    const {
      mergeTokens,
      flag,
      accountId,
      indexedAccountId,
      dbAccount,
      isAllNetworks,
      isManualRefresh,
      allNetworksAccountId,
      allNetworksNetworkId,
      saveToLocal,
      customTokensRawData,
      blockedTokensRawData,
      unblockedTokensRawData,
      aggregateTokenConfigMapRawData,
      aggregateTokenSymbolMapRawData,
      ...rest
    } = params;
    const { networkId } = rest;

    const isUrlAccount = accountUtils.isUrlAccountFn({ accountId });

    const currentNetworkId = isUrlAccount
      ? this._currentUrlNetworkId
      : this._currentNetworkId;

    const currentAccountId = isUrlAccount
      ? this._currentUrlAccountId
      : this._currentAccountId;

    if (isAllNetworks && currentNetworkId !== getNetworkIdsMap().onekeyall)
      return {
        ...getEmptyTokenData(),
        networkId: currentNetworkId,
      };

    const accountParams = {
      accountId,
      networkId,
      dbAccount,
      customTokensRawData,
    };
    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub(accountParams),
      this.backgroundApi.serviceAccount.getAccountAddressForApi(accountParams),
    ]);
    if (!accountAddress && !xpub) {
      console.log(
        `fetchAccountTokens ERROR: accountAddress and xpub are both empty`,
      );
      defaultLogger.token.request.fetchAccountTokenAccountAddressAndXpubBothEmpty(
        { params, accountAddress, xpub },
      );
      return getEmptyTokenData();
    }

    const accountXpubOrAddress =
      await this.backgroundApi.serviceAccount.buildAccountXpubOrAddress({
        getAccountXpubFn: async () => xpub,
        getAccountAddressFn: async () => accountAddress,
      });

    let [
      customTokens,
      hiddenTokens,
      unblockedTokens,
      blockedTokens,
      vaultSettings,
      network,
      aggregateHiddenTokens,
      allAggregateTokenInfo,
    ] = await Promise.all([
      this.backgroundApi.serviceCustomToken.getCustomTokens({
        ...accountParams,
        accountXpubOrAddress,
      }),
      this.backgroundApi.serviceCustomToken.getHiddenTokens({
        ...accountParams,
        accountXpubOrAddress,
      }),
      this.backgroundApi.serviceToken.getUnblockedTokens({
        networkId,
        unblockedTokensRawData,
      }),
      this.backgroundApi.serviceToken.getBlockedTokens({
        networkId,
        blockedTokensRawData,
      }),
      this.backgroundApi.serviceNetwork.getVaultSettings({ networkId }),
      this.backgroundApi.serviceNetwork.getNetworkSafe({ networkId }),
      // get aggregate hidden tokens
      this.backgroundApi.serviceCustomToken.getHiddenTokens({
        accountId: indexedAccountId ?? '',
        accountXpubOrAddress: indexedAccountId,
        networkId: AGGREGATE_TOKEN_MOCK_NETWORK_ID,
        customTokensRawData,
      }),
      this.backgroundApi.serviceToken.getAllAggregateTokenInfo(),
    ]);

    rest.contractList = [
      ...(rest.contractList ?? []),
      ...customTokens.map((t) => t.address),
    ];

    if (aggregateHiddenTokens?.length > 0) {
      aggregateHiddenTokens.forEach((t) => {
        if (allAggregateTokenInfo.allAggregateTokenMap[t.$key]) {
          // @ts-ignore
          hiddenTokens = [
            ...hiddenTokens,
            ...allAggregateTokenInfo.allAggregateTokenMap[t.$key].tokens.filter(
              (token) => token.networkId === networkId,
            ),
          ];
        }
      });
    }

    rest.hiddenTokens = uniq(hiddenTokens.map((t) => t.address));

    rest.unblockedTokens = unblockedTokens;
    rest.blockedTokens = blockedTokens;

    // const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const controller = new AbortController();
    this._fetchAccountTokensControllers.push(controller);
    // const resp = await client.post<{
    //   data: IFetchAccountTokensResp;
    // }>(
    //   `/wallet/v1/account/token/list?flag=${flag || ''}`,
    //   {
    //     ...rest,
    //     accountAddress,
    //     xpub,
    //     isAllNetwork: isAllNetworks,
    //     isForceRefresh: isManualRefresh,
    //   },
    //   {
    //     signal: controller.signal,
    //     headers:
    //       await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
    //         accountId,
    //       }),
    //   },
    // );
    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });
    const resp = await vault.fetchTokenList({
      accountId,
      requestApiParams: {
        ...rest,
        accountAddress,
        xpub,
        isAllNetwork: isAllNetworks,
        isForceRefresh: isManualRefresh,
      },
      flag,
      signal: controller.signal,
    });
    let allTokens: ITokenData | undefined;

    let aggregateTokenListMap: Record<
      string,
      {
        commonToken: IAccountToken;
        tokens: IAccountToken[];
      }
    > = {};
    let aggregateTokenMap: Record<string, ITokenFiat> = {};

    resp.data.data.tokens.data = resp.data.data.tokens.data
      .map((token) => {
        let isSameSymbolWithAggregateToken = false;
        if (
          isAllNetworks &&
          aggregateTokenConfigMapRawData &&
          aggregateTokenSymbolMapRawData
        ) {
          const data = buildAggregateTokenListData({
            networkId,
            accountId,
            token,
            tokenMap: resp.data.data.tokens.map,
            aggregateTokenListMap,
            aggregateTokenMap,
            aggregateTokenConfigMapRawData,
            aggregateTokenSymbolMapRawData,
            networkName: network?.name ?? '',
          });

          isSameSymbolWithAggregateToken = data.isSameSymbolWithAggregateToken;

          if (data.isAggregateToken) {
            aggregateTokenListMap = data.aggregateTokenListMap;
            aggregateTokenMap = data.aggregateTokenMap;
            return null;
          }
        }

        return {
          ...this.mergeTokenMetadataWithCustomDataSync({
            token,
            customTokens,
            networkId,
          }),
          accountId,
          networkId,
          networkName: network?.name,
          mergeAssets: vaultSettings.mergeDeriveAssetsEnabled,
          isSameSymbolWithAggregateToken,
        };
      })
      .filter(Boolean);

    resp.data.data.riskTokens.data = resp.data.data.riskTokens.data.map(
      (token) => ({
        ...this.mergeTokenMetadataWithCustomDataSync({
          token,
          customTokens,
          networkId,
        }),
        accountId,
        networkId,
        networkName: network?.name,
        mergeAssets: vaultSettings.mergeDeriveAssetsEnabled,
      }),
    );

    resp.data.data.smallBalanceTokens.data =
      resp.data.data.smallBalanceTokens.data
        .map((token) => {
          let isSameSymbolWithAggregateToken = false;
          if (
            isAllNetworks &&
            aggregateTokenConfigMapRawData &&
            aggregateTokenSymbolMapRawData
          ) {
            const data = buildAggregateTokenListData({
              accountId,
              networkName: network?.name ?? '',
              networkId,
              token,
              tokenMap: resp.data.data.smallBalanceTokens.map,
              aggregateTokenListMap,
              aggregateTokenMap,
              aggregateTokenConfigMapRawData,
              aggregateTokenSymbolMapRawData,
            });

            isSameSymbolWithAggregateToken =
              data.isSameSymbolWithAggregateToken;

            if (data.isAggregateToken) {
              aggregateTokenListMap = data.aggregateTokenListMap;
              aggregateTokenMap = data.aggregateTokenMap;
              return null;
            }
          }
          return {
            ...this.mergeTokenMetadataWithCustomDataSync({
              token,
              customTokens,
              networkId,
            }),
            accountId,
            networkId,
            networkName: network?.name,
            mergeAssets: vaultSettings.mergeDeriveAssetsEnabled,
            isSameSymbolWithAggregateToken,
          };
        })
        .filter(Boolean);

    const aggregateTokenList = Object.values(aggregateTokenListMap).map(
      (item) => item.commonToken,
    );

    resp.data.data.tokens.data = [
      ...resp.data.data.tokens.data,
      ...aggregateTokenList,
    ];

    if (mergeTokens) {
      const { tokens, riskTokens, smallBalanceTokens } = resp.data.data as any;
      ({ allTokens } = getMergedTokenData({
        tokens,
        riskTokens,
        smallBalanceTokens,
      }));
      if (allTokens) {
        allTokens.data = allTokens.data.map((token) => ({
          ...token,
          accountId,
          networkId,
          networkName: network?.name,
          mergeAssets: vaultSettings.mergeDeriveAssetsEnabled,
        }));
      }
      resp.data.data.allTokens = allTokens;
    }

    if (saveToLocal) {
      let tokenListValue = new BigNumber(0);
      tokenListValue = tokenListValue
        .plus(resp.data.data.tokens.fiatValue ?? '0')
        .plus(resp.data.data.smallBalanceTokens.fiatValue ?? '0');

      if (isAllNetworks) {
        const key = accountUtils.buildAccountLocalAssetsKey({
          networkId,
          accountAddress,
          xpub,
        });
        this.localAccountTokensCache.tokenList[key] =
          resp.data.data.tokens.data;
        this.localAccountTokensCache.smallBalanceTokenList[key] =
          resp.data.data.smallBalanceTokens.data;
        this.localAccountTokensCache.riskyTokenList[key] =
          resp.data.data.riskTokens.data;
        this.localAccountTokensCache.tokenListValue[key] =
          tokenListValue.toFixed();
        this.localAccountTokensCache.tokenListMap[key] = {
          ...resp.data.data.tokens.map,
          ...resp.data.data.smallBalanceTokens.map,
          ...resp.data.data.riskTokens.map,
        };
        await this._updateAccountLocalTokensDebounced();
      } else {
        await this.updateAccountLocalTokens({
          dbAccount,
          accountId,
          networkId,
          tokenList: resp.data.data.tokens.data,
          smallBalanceTokenList: resp.data.data.smallBalanceTokens.data,
          riskyTokenList: resp.data.data.riskTokens.data,
          tokenListValue: tokenListValue.toFixed(),
          tokenListMap: {
            ...resp.data.data.tokens.map,
            ...resp.data.data.smallBalanceTokens.map,
            ...resp.data.data.riskTokens.map,
          },
        });
      }
    }
    resp.data.data.isSameAllNetworksAccountData = !!(
      allNetworksAccountId &&
      allNetworksNetworkId &&
      allNetworksAccountId === currentAccountId &&
      allNetworksNetworkId === currentNetworkId
    );

    resp.data.data.accountId = accountId;
    resp.data.data.networkId = networkId;

    resp.data.data.aggregateTokenListMap = aggregateTokenListMap;
    resp.data.data.aggregateTokenMap = aggregateTokenMap;

    return resp.data.data;
  }

  @backgroundMethod()
  async mergeTokenMetadataWithCustomData<T extends IToken>(params: {
    token: T;
    customTokens: IAccountToken[];
    networkId: string;
  }): Promise<T> {
    return Promise.resolve(this.mergeTokenMetadataWithCustomDataSync(params));
  }

  private mergeTokenMetadataWithCustomDataSync<T extends IToken>({
    token,
    customTokens,
    networkId,
  }: {
    token: T;
    customTokens: IAccountToken[];
    networkId: string;
  }): T {
    if (!token.symbol || !token.name) {
      const customToken = customTokens.find(
        (t) =>
          t.address?.toLowerCase() === token.address?.toLowerCase() &&
          t.networkId === networkId,
      );
      if (customToken) {
        return {
          ...token,
          symbol: token.symbol || customToken.symbol,
          name: token.name || customToken.name,
        };
      }
    }
    return token;
  }

  _updateAccountLocalTokensDebounced = debounce(
    async () => {
      await this.backgroundApi.simpleDb.localTokens.updateAccountTokenListByCache(
        this.localAccountTokensCache,
      );
      this.localAccountTokensCache = {
        tokenList: {},
        smallBalanceTokenList: {},
        riskyTokenList: {},
        tokenListValue: {},
        tokenListMap: {},
      };
    },
    3000,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  public async fetchTokensDetails(
    params: IFetchTokenDetailParams,
  ): Promise<IFetchTokenDetailItem[]> {
    const {
      accountId,
      networkId,
      contractList,
      withCheckInscription,
      withFrozenBalance,
    } = params;

    const [accountAddress, xpub] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
    ]);

    if (!accountAddress && !xpub) {
      console.log(
        `fetchTokensDetails ERROR: accountAddress and xpub are both empty`,
      );
      defaultLogger.token.request.fetchTokensDetailsAccountAddressAndXpubBothEmpty(
        { params, accountAddress, xpub },
      );
      return [];
    }

    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });
    const resp = await vault.fetchTokenDetails({
      accountId,
      networkId,
      accountAddress,
      xpub,
      contractList,
      withCheckInscription,
      withFrozenBalance,
    });

    return vault.fillTokensDetails({
      tokensDetails: resp.data.data,
    });
  }

  @backgroundMethod()
  public async fetchTokenInfoOnly(params: {
    networkId: string;
    tokenAddress: string;
  }) {
    return this.fetchTokenInfoOnlyMemo(params);
  }

  fetchTokenInfoOnlyMemo = memoizee(
    async (params: { networkId: string; tokenAddress: string }) => {
      const { networkId, tokenAddress } = params;
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
      const resp = await client.post<{ data: IFetchTokenDetailItem[] }>(
        '/wallet/v1/account/token/search',
        {
          networkId,
          contractList: [tokenAddress],
        },
      );
      return resp.data.data[0];
    },
    {
      promise: true,
      primitive: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
      max: 10,
    },
  );

  @backgroundMethod()
  public async searchTokens(params: ISearchTokensParams) {
    const { accountId, networkId, contractList, keywords } = params;
    const controller = new AbortController();
    this._searchTokensControllers.push(controller);
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const resp = await vault.fetchTokenDetails({
      accountId,
      networkId,
      contractList,
      keywords,
      signal: controller.signal,
    });

    return resp.data.data.map((item) => ({
      ...item.info,
      $key: item.info.uniqueKey ?? item.info.address,
    }));
  }

  @backgroundMethod()
  public async updateLocalTokens({
    networkId,
    tokens,
  }: {
    networkId: string;
    tokens: IToken[];
  }) {
    return this.backgroundApi.simpleDb.localTokens.updateTokens({
      networkId,
      tokens,
    });
  }

  @backgroundMethod()
  public async clearLocalTokens() {
    return this.backgroundApi.simpleDb.localTokens.clearTokens();
  }

  @backgroundMethod()
  public async getNativeTokenAddress({ networkId }: { networkId: string }) {
    const vaultSettings = await getVaultSettings({ networkId });
    let tokenAddress = vaultSettings.networkInfo[networkId]?.nativeTokenAddress;
    if (typeof tokenAddress === 'string') {
      return tokenAddress;
    }
    tokenAddress = vaultSettings.networkInfo.default.nativeTokenAddress;
    if (typeof tokenAddress === 'string') {
      return tokenAddress;
    }
    return '';
  }

  @backgroundMethod()
  public async getNativeToken({
    accountId,
    networkId,
    tokenIdOnNetwork,
  }: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
  }) {
    let tokenAddress = tokenIdOnNetwork;

    if (networkUtils.isAllNetwork({ networkId })) {
      return null;
    }

    if (isNil(tokenAddress)) {
      tokenAddress = await this.getNativeTokenAddress({ networkId });
    }

    return this.getToken({
      accountId,
      networkId,
      tokenIdOnNetwork: tokenAddress ?? '',
    });
  }

  @backgroundMethod()
  public async getToken(params: {
    accountId: string;
    networkId: string;
    tokenIdOnNetwork: string;
  }) {
    const { accountId, networkId, tokenIdOnNetwork } = params;
    const localToken = await this.backgroundApi.simpleDb.localTokens.getToken({
      networkId,
      tokenIdOnNetwork,
    });

    if (localToken) {
      if (!localToken.symbol || !localToken.name) {
        const customTokens =
          await this.backgroundApi.serviceCustomToken.getCustomTokens({
            accountId,
            networkId,
          });
        return this.mergeTokenMetadataWithCustomData({
          token: localToken,
          customTokens,
          networkId,
        });
      }
      return localToken;
    }

    if (localToken) return localToken;

    try {
      let tokensDetails: IFetchTokenDetailItem[] = [];

      if (accountId === '') {
        tokensDetails = [
          await this.fetchTokenInfoOnly({
            networkId,
            tokenAddress: tokenIdOnNetwork,
          }),
        ];
      } else {
        tokensDetails = await this.fetchTokensDetails({
          accountId,
          networkId,
          contractList: [tokenIdOnNetwork],
        });
      }

      let tokenInfo = tokensDetails[0].info;

      if (!tokenInfo.symbol || !tokenInfo.name) {
        const customTokens =
          await this.backgroundApi.serviceCustomToken.getCustomTokens({
            accountId,
            networkId,
          });

        tokenInfo = this.mergeTokenMetadataWithCustomDataSync({
          token: tokenInfo,
          customTokens,
          networkId,
        });
      }

      void this.updateLocalTokens({
        networkId,
        tokens: [tokenInfo],
      });

      return tokenInfo;
    } catch (error) {
      console.log('fetchTokensDetails ERROR:', error);
    }

    return null;
  }

  @backgroundMethod()
  public async updateAccountLocalTokens(params: {
    dbAccount?: IDBAccount;
    accountId: string;
    networkId: string;
    tokenList: IAccountToken[];
    smallBalanceTokenList: IAccountToken[];
    riskyTokenList: IAccountToken[];
    tokenListMap: Record<string, ITokenFiat>;
    tokenListValue: string;
  }) {
    const {
      dbAccount,
      accountId,
      networkId,
      tokenList,
      smallBalanceTokenList,
      riskyTokenList,
      tokenListMap,
      tokenListValue,
    } = params;
    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        dbAccount,
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        dbAccount,
        accountId,
        networkId,
      }),
    ]);

    await this.backgroundApi.simpleDb.localTokens.updateAccountTokenList({
      networkId,
      accountAddress,
      xpub,
      tokenList,
      smallBalanceTokenList,
      riskyTokenList,
      tokenListMap,
      tokenListValue,
    });
  }

  @backgroundMethod()
  public async getAccountLocalTokens(params: {
    accountId: string;
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    simpleDbLocalTokensRawData?: ISimpleDBLocalTokens;
  }) {
    const perf = perfUtils.createPerf({
      name: EPerformanceTimerLogNames.allNetwork__getAccountLocalTokens,
    });

    const { accountId, networkId, simpleDbLocalTokensRawData } = params;

    let accountAddress: string | undefined;
    let xpub: string | undefined;

    if (params.accountAddress || params.xpub) {
      accountAddress = params.accountAddress;
      xpub = params.xpub;
    } else {
      perf.markStart('getAccountXpubAndAddress');
      [xpub, accountAddress] = await Promise.all([
        this.backgroundApi.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        }),
        this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        }),
      ]);
      perf.markEnd('getAccountXpubAndAddress');
    }

    perf.markStart('getAccountTokenList', {
      accountAddress,
      networkId,
      rawDataExist: !!simpleDbLocalTokensRawData,
    });
    const localTokens =
      await this.backgroundApi.simpleDb.localTokens.getAccountTokenList({
        networkId,
        accountAddress,
        xpub,
        simpleDbLocalTokensRawData,
      });
    perf.markEnd('getAccountTokenList');

    let tokenList = localTokens.tokenList;
    let smallBalanceTokenList = localTokens.smallBalanceTokenList;
    let riskyTokenList = localTokens.riskyTokenList;

    if (
      (tokenList[0]?.accountId && tokenList[0]?.accountId !== accountId) ||
      (smallBalanceTokenList[0]?.accountId &&
        smallBalanceTokenList[0]?.accountId !== accountId) ||
      (riskyTokenList[0]?.accountId &&
        riskyTokenList[0]?.accountId !== accountId)
    ) {
      perf.markStart('mapAccountTokenList');
      tokenList = tokenList.map((token) => ({
        ...token,
        accountId,
        networkId,
      }));

      smallBalanceTokenList = smallBalanceTokenList.map((token) => ({
        ...token,
        accountId,
        networkId,
      }));

      riskyTokenList = riskyTokenList.map((token) => ({
        ...token,
        accountId,
        networkId,
      }));
      perf.markEnd('mapAccountTokenList');
    }

    perf.done();
    return {
      ...localTokens,
      tokenList,
      smallBalanceTokenList,
      riskyTokenList,
      accountId,
      networkId,
    };
  }

  @backgroundMethod()
  public async getRiskTokenManagementRawData() {
    return this.backgroundApi.simpleDb.riskTokenManagement.getRawData();
  }

  @backgroundMethod()
  public async getCustomTokensRawData() {
    return this.backgroundApi.simpleDb.customTokens.getRawData();
  }

  getUnblockedTokensMemo = memoizee(
    async ({ networkId }: { networkId: string }) => {
      return this.backgroundApi.simpleDb.riskTokenManagement.getUnblockedTokens(
        {
          networkId,
        },
      );
    },
    {
      promise: true,
      primitive: true,
      max: 50,
      maxAge: timerUtils.getTimeDurationMs({ minute: 1 }),
    },
  );

  getBlockedTokensMemo = memoizee(
    async ({ networkId }: { networkId: string }) => {
      return this.backgroundApi.simpleDb.riskTokenManagement.getBlockedTokens({
        networkId,
      });
    },
    {
      promise: true,
      primitive: true,
      max: 50,
      maxAge: timerUtils.getTimeDurationMs({ minute: 1 }),
    },
  );

  @backgroundMethod()
  public async clearRiskTokensManagementCache() {
    this.getUnblockedTokensMemo.clear();
    this.getBlockedTokensMemo.clear();
  }

  @backgroundMethod()
  public async getUnblockedTokensMap({
    networkId,
    unblockedTokensRawData,
  }: {
    networkId: string;
    unblockedTokensRawData?: IRiskTokenManagementDBStruct['unblockedTokens'];
  }) {
    if (unblockedTokensRawData) {
      return {
        [networkId]: unblockedTokensRawData[networkId] ?? {},
      };
    }

    return this.getUnblockedTokensMemo({ networkId });
  }

  @backgroundMethod()
  public async getBlockedTokensMap({
    networkId,
    blockedTokensRawData,
  }: {
    networkId: string;
    blockedTokensRawData?: IRiskTokenManagementDBStruct['blockedTokens'];
  }) {
    if (blockedTokensRawData) {
      return {
        [networkId]: blockedTokensRawData[networkId] ?? {},
      };
    }

    return this.getBlockedTokensMemo({ networkId });
  }

  @backgroundMethod()
  public async getBlockedTokens({
    networkId,
    blockedTokensRawData,
  }: {
    networkId: string;
    blockedTokensRawData?: IRiskTokenManagementDBStruct['blockedTokens'];
  }) {
    const blockedTokensMap = await this.getBlockedTokensMap({
      networkId,
      blockedTokensRawData,
    });
    const blockedTokensMapByNetworkId = blockedTokensMap[networkId] ?? {};
    return Object.keys(blockedTokensMapByNetworkId).filter(
      (tokenAddress) => blockedTokensMapByNetworkId[tokenAddress],
    );
  }

  @backgroundMethod()
  public async getUnblockedTokens({
    networkId,
    unblockedTokensRawData,
  }: {
    networkId: string;
    unblockedTokensRawData?: IRiskTokenManagementDBStruct['unblockedTokens'];
  }) {
    const unblockedTokensMap = await this.getUnblockedTokensMap({
      networkId,
      unblockedTokensRawData,
    });
    const unblockedTokensMapByNetworkId = unblockedTokensMap[networkId] ?? {};
    return Object.keys(unblockedTokensMapByNetworkId).filter(
      (tokenAddress) => unblockedTokensMapByNetworkId[tokenAddress],
    );
  }

  @backgroundMethod()
  public async updateRiskTokensState({
    blockedTokens,
    unblockedTokens,
  }: {
    blockedTokens: IRiskTokenManagementDBStruct['blockedTokens'];
    unblockedTokens: IRiskTokenManagementDBStruct['unblockedTokens'];
  }) {
    return this.backgroundApi.simpleDb.riskTokenManagement.updateRiskTokensState(
      {
        blockedTokens,
        unblockedTokens,
      },
    );
  }

  @backgroundMethod()
  public async syncAggregateTokenConfigMap() {
    await this.abortFetchAggregateTokenMap();
    const resp = await this.fetchAggregateTokenConfigMap();

    if (!resp) {
      return;
    }
    const { tokens = {}, meta: { homeDefaults = [] } = {} } = resp;
    const allAggregateTokenMap: Record<
      string,
      {
        tokens: IAccountToken[];
      }
    > = {};

    const aggregateTokenConfigMap: Record<string, IAggregateToken> = {};
    const homeDefaultTokenMap: Record<string, IHomeDefaultToken> = {};
    const aggregateTokenSymbolMap: Record<string, boolean> = {};
    const listedNetworkMap = getListedNetworkMap();
    homeDefaults.forEach((homeDefault) => {
      homeDefaultTokenMap[
        buildHomeDefaultTokenMapKey({
          networkId: homeDefault.networkId,
          symbol: homeDefault.symbol,
        })
      ] = homeDefault;
    });
    Object.entries(tokens).forEach(
      ([commonSymbol, { data, logoURI, name }]) => {
        aggregateTokenSymbolMap[commonSymbol] = true;
        const filteredData = data.filter(
          (token) => !!listedNetworkMap[token.networkId],
        );

        if (filteredData.length > 1) {
          filteredData.forEach((token) => {
            const aggregateTokenKey = buildAggregateTokenListMapKeyForTokenList(
              {
                commonSymbol,
              },
            );

            if (allAggregateTokenMap[aggregateTokenKey]) {
              allAggregateTokenMap[aggregateTokenKey].tokens.push({
                ...token,
                $key: buildAggregateTokenListMapKeyForTokenList({
                  commonSymbol,
                  networkId: token.networkId,
                }),
                name,
                symbol: commonSymbol,
                isNative: false,
                logoURI,
                commonSymbol,
                address: token.address || token.assetType || '',
              });
            } else {
              allAggregateTokenMap[aggregateTokenKey] = {
                tokens: [
                  {
                    ...token,
                    $key: buildAggregateTokenListMapKeyForTokenList({
                      commonSymbol,
                      networkId: token.networkId,
                    }),
                    name,
                    symbol: commonSymbol,
                    isNative: false,
                    logoURI,
                    commonSymbol,
                    address: token.address || token.assetType || '',
                  },
                ],
              };
            }

            aggregateTokenConfigMap[
              buildAggregateTokenMapKeyForAggregateConfig({
                networkId: token.networkId,
                tokenAddress: token.address || token.assetType || '',
              })
            ] = {
              ...token,
              name,
              logoURI,
              commonSymbol,
            };
          });
        }
      },
    );

    const allAggregateTokens: IAccountToken[] = Object.keys(
      allAggregateTokenMap,
    ).map((key) => {
      const aggregateToken = allAggregateTokenMap[key].tokens[0];
      return {
        $key: key,
        isAggregateToken: true,
        commonSymbol: aggregateToken.commonSymbol,
        name: aggregateToken.name,
        symbol: aggregateToken.symbol,
        networkId: '',
        address: key,
        isNative: false,
        decimals: 0,
        logoURI: aggregateToken.logoURI,
      };
    });

    await this.backgroundApi.simpleDb.aggregateToken.updateAllAggregateInfo({
      allAggregateTokens,
      aggregateTokenConfigMap,
      homeDefaultTokenMap,
      allAggregateTokenMap,
      aggregateTokenSymbolMap,
    });

    return aggregateTokenConfigMap;
  }

  @backgroundMethod()
  public async getHomeDefaultTokenMap() {
    return this.backgroundApi.simpleDb.aggregateToken.getHomeDefaultTokenMap();
  }

  @backgroundMethod()
  public async getAggregateTokenSymbolMap() {
    return this.backgroundApi.simpleDb.aggregateToken.getAggregateTokenSymbolMap();
  }

  @backgroundMethod()
  public async getAggregateTokenConfigMap() {
    return this.backgroundApi.simpleDb.aggregateToken.getAggregateTokenConfigMap();
  }

  @backgroundMethod()
  public async fetchAggregateTokenConfigMap() {
    const controller = new AbortController();
    this._fetchAggregateTokenMapControllers.push(controller);
    try {
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
      const resp = await client.get<IFetchAggregateTokenConfigMapResp>(
        '/wallet/v1/tokens/aggregate-chains',
      );
      return resp.data.data;
    } catch (e) {
      return null;
    }
  }

  @backgroundMethod()
  public async updateLocalAggregateTokenMap({
    networkId,
    accountId,
    aggregateTokenMap,
  }: {
    networkId: string;
    accountId: string;
    aggregateTokenMap: Record<string, ITokenFiat>;
  }) {
    return this.backgroundApi.simpleDb.aggregateToken.updateAggregateTokenMap({
      networkId,
      accountId,
      aggregateTokenMap,
    });
  }

  @backgroundMethod()
  public async getLocalAggregateTokenMap({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    return this.backgroundApi.simpleDb.aggregateToken.getAggregateTokenMap({
      networkId,
      accountId,
    });
  }

  @backgroundMethod()
  public async getLocalAggregateTokenListMap({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    return this.backgroundApi.simpleDb.aggregateToken.getAggregateTokenListMap({
      networkId,
      accountId,
    });
  }

  @backgroundMethod()
  public async updateLocalAggregateTokenListMap({
    accountId,
    networkId,
    aggregateTokenListMap,
  }: {
    accountId: string;
    networkId: string;
    aggregateTokenListMap: Record<
      string,
      {
        tokens: IAccountToken[];
      }
    >;
  }) {
    return this.backgroundApi.simpleDb.aggregateToken.updateAggregateTokenListMap(
      {
        accountId,
        networkId,
        aggregateTokenListMap,
      },
    );
  }

  @backgroundMethod()
  public async getAllAggregateTokenInfo() {
    const rawData =
      await this.backgroundApi.simpleDb.aggregateToken.getRawData();
    return {
      allAggregateTokenMap: rawData?.allAggregateTokenMap ?? {},
      allAggregateTokens: rawData?.allAggregateTokens ?? [],
    };
  }
}

export default ServiceToken;
