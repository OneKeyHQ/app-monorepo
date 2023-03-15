import BigNumber from 'bignumber.js';
import { debounce, isEmpty, uniq, xor } from 'lodash';
import memoizee from 'memoizee';

import { getBalancesFromApi } from '@onekeyhq/engine/src/apiProxyUtils';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import type { CheckParams } from '@onekeyhq/engine/src/managers/goplus';
import {
  checkSite,
  fetchSecurityInfo,
  getAddressRiskyItems,
  getRiskLevel,
  getTokenRiskyItems,
} from '@onekeyhq/engine/src/managers/goplus';
import {
  fetchTokenSource,
  fetchTools,
  formatServerToken,
  getBalanceKey,
} from '@onekeyhq/engine/src/managers/token';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { GoPlusTokenSecurity } from '@onekeyhq/engine/src/types/goplus';
import { GoPlusSupportApis } from '@onekeyhq/engine/src/types/goplus';
import { TokenRiskLevel } from '@onekeyhq/engine/src/types/token';
import type { ServerToken, Token } from '@onekeyhq/engine/src/types/token';
import { setTools } from '@onekeyhq/kit/src/store/reducers/data';
import type { TokenBalanceValue } from '@onekeyhq/kit/src/store/reducers/tokens';
import {
  setAccountTokens,
  setAccountTokensBalances,
} from '@onekeyhq/kit/src/store/reducers/tokens';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { fetchData } from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

export type IFetchAccountTokensParams = {
  accountId: string;
  networkId: string;
  forceReloadTokens?: boolean;
  includeTop50TokensQuery?: boolean;
};

@backgroundClass()
export default class ServiceToken extends ServiceBase {
  private interval: any;

  @bindThis()
  registerEvents() {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    appEventBus.on(AppEventBusNames.NetworkChanged, () => {
      this.fetchAccountTokens({ includeTop50TokensQuery: true });
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    appEventBus.on(AppEventBusNames.CurrencyChanged, () => {
      this.fetchAccountTokens({ includeTop50TokensQuery: true });
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  @bindThis()
  @backgroundMethod()
  async startRefreshAccountTokens() {
    if (this.interval) {
      return;
    }
    this.interval = setInterval(() => {
      this.fetchAccountTokens({ includeTop50TokensQuery: false });
    }, getTimeDurationMs({ seconds: 15 }));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  @bindThis()
  @backgroundMethod()
  async stopRefreshAccountTokens() {
    clearInterval(this.interval);
    this.interval = null;
  }

  private _refreshTokenBalanceWithMemo = memoizee(
    async ({
      accountId,
      networkId,
      forceReloadTokens = false,
      includeTop50TokensQuery = false,
    }: IFetchAccountTokensParams) => {
      const { engine, dispatch, servicePrice, appSelector } =
        this.backgroundApi;

      const accountTokens = await engine.getTokens(
        networkId,
        accountId,
        true,
        true,
        forceReloadTokens,
      );

      const { selectedFiatMoneySymbol } = appSelector((s) => s.settings);
      const [, autodetectedTokens = []] = await this.getAccountTokenBalance({
        accountId,
        networkId,
        tokenIds: accountTokens.map((token) => token.tokenIdOnNetwork),
        withMain: true,
        includeTop50TokensQuery,
      });
      if (autodetectedTokens.length) {
        accountTokens.push(...autodetectedTokens);
      }
      // check token prices
      servicePrice.fetchSimpleTokenPrice({
        networkId,
        accountId,
        tokenIds: accountTokens.map((t) => t.tokenIdOnNetwork),
        vsCurrency: selectedFiatMoneySymbol,
      });
      dispatch(
        setAccountTokens({
          accountId,
          networkId,
          tokens: accountTokens,
        }),
      );
      return accountTokens;
    },
    {
      promise: true,
      primitive: true,
      max: 50,
      maxAge: getTimeDurationMs({ seconds: 1 }),
      normalizer: (args) => JSON.stringify(args),
    },
  );

  @bindThis()
  @backgroundMethod()
  async fetchAccountTokens(options: Partial<IFetchAccountTokensParams> = {}) {
    const { appSelector } = this.backgroundApi;
    const { activeAccountId, activeNetworkId } = appSelector((s) => s.general);

    const accountId = options.accountId || activeAccountId || '';
    const networkId = options.networkId || activeNetworkId || '';

    if (!accountId || !networkId) {
      return [];
    }
    return this._refreshTokenBalanceWithMemo({
      accountId,
      networkId,
      ...options,
    });
  }

  async _batchFetchAccountBalances({
    walletId,
    networkId,
    accountIds,
  }: {
    walletId: string;
    networkId: string;
    accountIds: string[];
  }) {
    const { dispatch, engine, servicePassword } = this.backgroundApi;

    const vault = await engine.getWalletOnlyVault(networkId, walletId);
    const vaultSettings = await engine.getVaultSettings(networkId);
    const dbNetwork = await engine.dbApi.getNetwork(networkId);
    const dbAccounts = await engine.dbApi.getAccounts(accountIds);

    let balances: Array<BigNumber | undefined>;
    let password;

    if (vaultSettings.validationRequired) {
      password = await servicePassword.getPassword();
    }
    try {
      const balancesAddress = await Promise.all(
        dbAccounts.map(async (a) => {
          if (a.type === AccountType.UTXO) {
            const address = await vault.getFetchBalanceAddress(a);
            return { address };
          }
          if (a.type === AccountType.VARIANT) {
            const address = await vault.addressFromBase(a);
            return { address };
          }
          return { address: a.address };
        }),
      );

      const requests = balancesAddress.map((acc) => ({ address: acc.address }));
      balances = await vault.getBalances(requests, password);
    } catch {
      balances = dbAccounts.map(() => undefined);
    }

    const data = dbAccounts.reduce((result, item, index) => {
      const balance = balances[index];
      result[item.id] = balance
        ? balance.div(new BigNumber(10).pow(dbNetwork.decimals)).toFixed()
        : undefined;
      return result;
    }, {} as Record<string, string | undefined>);

    const actions: any[] = [];
    Object.entries(data).forEach(([key, value]) => {
      if (!Number.isNaN(value)) {
        actions.push(
          setAccountTokensBalances({
            accountId: key,
            networkId,
            tokensBalance: {
              'main': {
                balance: value ?? '0',
              },
            },
          }),
        );
      }
    });
    if (actions.length > 0) {
      dispatch(...actions);
    }
  }

  batchFetchAccountBalancesDebounce = debounce(
    // eslint-disable-next-line @typescript-eslint/unbound-method
    this._batchFetchAccountBalances,
    600,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  batchFetchAccountBalances({
    walletId,
    networkId,
    accountIds,
  }: {
    walletId: string;
    networkId: string;
    accountIds: string[];
  }) {
    return this.batchFetchAccountBalancesDebounce({
      walletId,
      networkId,
      accountIds,
    });
  }

  @backgroundMethod()
  async addAccountToken(
    networkId: string,
    accountId: string,
    address: string,
    logoURI?: string,
  ): Promise<Token | undefined> {
    const { engine, appSelector } = this.backgroundApi;
    if (!address) {
      return;
    }
    const accountTokens = appSelector((s) => s.tokens.accountTokens);
    const tokens = accountTokens[networkId]?.[accountId] ?? ([] as Token[]);
    const isExists = tokens.find((item) => item.tokenIdOnNetwork === address);
    if (isExists) {
      return;
    }
    const info = await fetchSecurityInfo<GoPlusTokenSecurity>({
      networkId,
      address,
      apiName: GoPlusSupportApis.token_security,
    });
    const riskLevel = info ? getRiskLevel(info) : TokenRiskLevel.UNKNOWN;
    const result = await engine.quickAddToken(
      accountId,
      networkId,
      address,
      logoURI,
      {
        riskLevel,
      },
    );
    await this.fetchAccountTokens({
      accountId,
      networkId,
      includeTop50TokensQuery: false,
    });
    return result;
  }

  @backgroundMethod()
  async fetchTokenSource() {
    return fetchTokenSource();
  }

  @backgroundMethod()
  async getTokenRiskyItems(params: CheckParams) {
    return this._getTokenRiskyItemsWithMemo(params);
  }

  _getTokenRiskyItemsWithMemo = memoizee(getTokenRiskyItems, {
    promise: true,
    primitive: true,
    max: 500,
    maxAge: getTimeDurationMs({ day: 1 }),
    normalizer: (args) => JSON.stringify(args),
  });

  @backgroundMethod()
  async getAddressRiskyItems(params: CheckParams) {
    return getAddressRiskyItems(params);
  }

  @backgroundMethod()
  async getSiteSecurityInfo(url: string, chainId: string) {
    return checkSite(url, chainId);
  }

  @backgroundMethod()
  async fetchTools() {
    const tools = await fetchTools();
    const { dispatch } = this.backgroundApi;
    dispatch(setTools(tools));
  }

  @backgroundMethod()
  async getAccountBalanceFromServerApi(
    networkId: string,
    accountId: string,
    withMain = true,
  ): Promise<
    [
      Record<string, TokenBalanceValue>,
      Token[] | undefined,
      Record<string, Token>,
    ]
  > {
    const { engine, serviceAccount } = this.backgroundApi;
    const { address: accountAddress, xpub } =
      await serviceAccount.getAcccountAddressWithXpub(accountId, networkId);

    const accountTokens = await engine.getTokens(
      networkId,
      accountId,
      withMain,
      true,
      false,
    );

    const ret: Record<string, TokenBalanceValue> = {};
    const balancesFromApi =
      (await getBalancesFromApi({
        networkId,
        address: accountAddress,
        xpub,
      })) || [];
    const removedTokens = await simpleDb.token.localTokens.getRemovedTokens(
      accountId,
      networkId,
    );
    const allAccountTokens: Token[] = [];
    const tokens = await this.batchTokenDetail(
      networkId,
      balancesFromApi.map((b) => b.address),
    );
    for (const {
      address,
      balance,
      sendAddress,
      bestBlockNumber: blockHeight,
    } of balancesFromApi.filter(
      (b) =>
        (+b.balance > 0 || !b.address) && !removedTokens.includes(b.address),
    )) {
      const token = tokens[address];
      if (token) {
        // only record new token balances
        // other token balances still get from RPC for accuracy
        Object.assign(ret, {
          [getBalanceKey({
            address,
            sendAddress,
          })]: {
            balance,
            blockHeight,
          },
        });
        allAccountTokens.push({
          ...token,
          sendAddress,
          autoDetected: !accountTokens.some((t) => t.address === address),
        });
      }
    }
    return [ret, allAccountTokens, tokens];
  }

  async batchTokenDetail(networkId: string, addresses: string[]) {
    const addressMap: Record<string, 1> = addresses.reduce(
      (memo, n) => ({
        ...memo,
        [n]: 1,
      }),
      {},
    );
    const localTokens: Token[] = (
      await this.backgroundApi.engine.getTokens(
        networkId,
        undefined,
        true,
        true,
      )
    ).filter((t) => addressMap[t?.address ?? '']);

    const serverAddress = xor(
      addresses,
      localTokens.map((t) => t.address ?? ''),
    );

    let serverTokens: Token[] = [];
    if (serverAddress.length) {
      serverTokens = (
        await fetchData<ServerToken[]>(
          `/token/detail/batch`,
          {
            networkId,
            addresses: serverAddress,
          },
          [],
          'POST',
        )
      ).map(formatServerToken);
    }

    const result: Record<string, Token> = [
      ...serverTokens,
      ...localTokens,
    ].reduce((sum, n) => {
      sum[n.address ?? ''] = n;
      return sum;
    }, {} as Record<string, Token>);

    const restAddress = xor(
      serverAddress,
      serverTokens.map((t) => t.address),
    );
    const rpcTokens: Token[] = [];
    for (const address of restAddress) {
      const detail = await this.backgroundApi.engine.findToken({
        networkId,
        tokenIdOnNetwork: address ?? '',
      });
      if (detail) {
        result[address ?? ''] = detail;
        rpcTokens.push(detail);
      }
    }
    await simpleDb.token.insertTokens(networkId, [
      ...serverTokens,
      ...rpcTokens,
    ]);
    return result;
  }

  @backgroundMethod()
  async getAccountBalanceFromRpc(
    networkId: string,
    accountId: string,
    tokenIds: string[],
    withMain = true,
    tokensMap: Record<string, Token> = {},
  ): Promise<[Record<string, TokenBalanceValue>, Token[] | undefined]> {
    const { engine, serviceNetwork, servicePassword } = this.backgroundApi;
    const network = await engine.getNetwork(networkId);
    const vaultSettings = await engine.getVaultSettings(networkId);

    let password;

    if (vaultSettings.validationRequired) {
      password = await servicePassword.getPassword();
    }

    const vault = await engine.getVault({ networkId, accountId });
    const status = await serviceNetwork.measureRpcStatus(networkId);
    const blockHeight = String(status?.latestBlock ?? '0');

    const tokensToGet = uniq(tokenIds);
    const ret: Record<string, TokenBalanceValue> = {};
    const balances = await vault.getAccountBalance(
      tokensToGet,
      withMain,
      password,
    );
    if (withMain && typeof balances[0] !== 'undefined') {
      Object.assign(ret, {
        main: {
          balance: balances[0]
            .div(new BigNumber(10).pow(network.decimals))
            .toFixed(),
          blockHeight,
        },
      });
    }
    const balanceList = balances.slice(withMain ? 1 : 0);
    const details = await this.batchTokenDetail(networkId, tokensToGet);
    const tokens = Object.assign(details, tokensMap);
    for (let i = 0; i < balanceList.length; i += 1) {
      const balance = balanceList[i];
      const tokenAddress = tokensToGet[i];
      const token = tokens[tokenAddress];
      const decimals = token?.decimals;
      if (
        token &&
        typeof decimals !== 'undefined' &&
        typeof balance !== 'undefined'
      ) {
        const bal = balance.div(new BigNumber(10).pow(decimals)).toFixed();
        Object.assign(ret, {
          [getBalanceKey({
            address: tokenAddress,
          })]: {
            balance: bal,
            blockHeight,
          },
        });
      }
    }
    return [ret, undefined];
  }

  @backgroundMethod()
  async getAccountTokenBalance(params: {
    accountId: string;
    networkId: string;
    tokenIds?: string[];
    withMain?: boolean;
    includeTop50TokensQuery?: boolean;
  }): Promise<[Record<string, TokenBalanceValue>, Token[] | undefined]> {
    const { engine, dispatch, appSelector } = this.backgroundApi;
    const {
      accountId,
      networkId,
      tokenIds,
      withMain = true,
      includeTop50TokensQuery = false,
    } = params;

    let serverApiFetchFailed = false;
    let serverBalances: Record<string, TokenBalanceValue> = {};
    let rpcBalances: Record<string, TokenBalanceValue> = {};
    let autodetectedTokens: Token[] = [];
    let tokensMap: Record<string, Token> = {};
    try {
      [serverBalances, autodetectedTokens = [], tokensMap] =
        await this.getAccountBalanceFromServerApi(
          networkId,
          accountId,
          withMain,
        );
    } catch (e) {
      serverApiFetchFailed = true;
      debugLogger.common.error(
        `getBalancesFromApi`,
        {
          params: [networkId, accountId],
          message: e instanceof Error ? e.message : e,
        },
        e,
      );
    }
    try {
      const tokens = [
        ...(appSelector((s) => s.tokens.accountTokens)?.[networkId]?.[
          accountId
        ] ?? []),
        ...autodetectedTokens,
      ];
      if (includeTop50TokensQuery || serverApiFetchFailed) {
        const top50tokens = await engine.getTopTokensOnNetwork(networkId, 50);
        const accountTokensInDB = await engine.getTokens(
          networkId,
          accountId,
          true,
          true,
        );
        tokens.push(...top50tokens, ...accountTokensInDB);
      }
      const tokensToGet = tokens
        .map((t) => t.tokenIdOnNetwork)
        .concat(tokenIds || [])
        .filter(Boolean);
      [rpcBalances] = await this.getAccountBalanceFromRpc(
        networkId,
        accountId,
        tokensToGet,
        withMain,
        tokensMap,
      );
    } catch (e) {
      debugLogger.common.error(
        `getBalancesFromRpc`,
        {
          params: [networkId, accountId],
          message: e instanceof Error ? e.message : e,
        },
        e,
      );
    }
    const balances: Record<string, TokenBalanceValue> = {};
    for (const k of Object.keys({
      ...serverBalances,
      ...rpcBalances,
    })) {
      const rpcValue = rpcBalances[k];
      const serverValue = serverBalances[k];
      if (!serverValue || !rpcValue) {
        Object.assign(balances, {
          [k]: serverValue || rpcValue,
        });
      } else if (!serverValue.blockHeight || !rpcValue.blockHeight) {
        Object.assign(balances, {
          [k]: rpcValue,
        });
      } else {
        const v = new BigNumber(rpcValue.blockHeight).isGreaterThan(
          serverValue.blockHeight,
        )
          ? rpcValue
          : serverValue;
        Object.assign(balances, {
          [k]: v,
        });
      }
    }

    dispatch(
      setAccountTokensBalances({
        accountId,
        networkId,
        tokensBalance: balances,
      }),
    );
    return [balances, autodetectedTokens];
  }

  @backgroundMethod()
  async getMinDepositAmount({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    if (isEmpty(networkId) || isEmpty(accountId)) return 0;

    const { engine } = this.backgroundApi;

    const vault = await engine.getVault({
      accountId,
      networkId,
    });

    return vault.getMinDepositAmount();
  }
}
