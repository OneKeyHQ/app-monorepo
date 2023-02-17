/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import type { ISwftcCoin } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntitySwap';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import { formatServerToken } from '@onekeyhq/engine/src/managers/token';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { ServerToken, Token } from '@onekeyhq/engine/src/types/token';
import type { IEncodedTx } from '@onekeyhq/engine/src/vaults/types';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  clearState,
  clearUserSelectedQuoter,
  resetState,
  resetTypedValue,
  setInputToken,
  setOutputToken,
  setQuote,
  setQuoteLimited,
  setRecipient,
  setResponses,
  setSendingAccount,
  setShowMoreQuoteDetail,
  setTypedValue,
  setUserSelectedQuoter,
  switchTokens,
} from '@onekeyhq/kit/src/store/reducers/swap';
import {
  clearTransactions,
  setCoingeckoIds,
  setRecommendedSlippage,
  setSlippage,
  setSwapChartMode,
  setSwapFeePresetIndex,
  updateTokenList,
} from '@onekeyhq/kit/src/store/reducers/swapTransactions';
import type { SendConfirmParams } from '@onekeyhq/kit/src/views/Send/types';
import type {
  FetchQuoteParams,
  FieldType,
  QuoteData,
  QuoteLimited,
  Recipient,
} from '@onekeyhq/kit/src/views/Swap/typings';
import { stringifyTokens } from '@onekeyhq/kit/src/views/Swap/utils';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceSwap extends ServiceBase {
  prevParams: FetchQuoteParams | undefined;

  @bindThis()
  registerEvents() {
    appEventBus.on(
      AppEventBusNames.CurrencyChanged,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      this.refreshSelectedTokenPrice,
    );
  }

  getNetwork(networkId?: string): Network | undefined {
    if (!networkId) {
      return;
    }
    const { appSelector } = this.backgroundApi;
    const networks = appSelector((s) => s.runtime.networks);
    return networks.find((network) => network.id === networkId);
  }

  @backgroundMethod()
  async getServerEndPoint() {
    return getFiatEndpoint();
  }

  @backgroundMethod()
  async getSwftcCoins() {
    return simpleDb.swap.getSwftcCoins();
  }

  @backgroundMethod()
  async setSwftcCoins(coins: ISwftcCoin[]) {
    return simpleDb.swap.setSwftcCoins(coins);
  }

  @backgroundMethod()
  async selectToken(field: FieldType, network?: Network, token?: Token) {
    const { dispatch } = this.backgroundApi;
    if (field === 'INPUT') {
      dispatch(setInputToken({ token, network }));
    } else {
      dispatch(setOutputToken({ token, network }));
    }
  }

  @backgroundMethod()
  async setInputToken(token: Token) {
    const { appSelector } = this.backgroundApi;
    const outputToken = appSelector((s) => s.swap.outputToken);
    const inputToken = appSelector((s) => s.swap.inputToken);
    if (
      outputToken &&
      outputToken.networkId === token.networkId &&
      outputToken.tokenIdOnNetwork === token.tokenIdOnNetwork
    ) {
      this.selectToken(
        'OUTPUT',
        this.getNetwork(inputToken?.networkId),
        inputToken,
      );
    }
    this.selectToken('INPUT', this.getNetwork(token.networkId), token);
    this.setSendingAccountByNetwork(this.getNetwork(token.networkId));
  }

  @backgroundMethod()
  async setDefaultInputToken() {
    const { engine, appSelector } = this.backgroundApi;

    const USDC = {
      name: 'USD Coin',
      symbol: 'USDC',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
      logoURI:
        'https://common.onekey-asset.com/token/evm-1/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48.jpg',
      impl: 'evm',
      chainId: '1',
    } as ServerToken;

    const network = await engine.getNetwork(OnekeyNetwork.eth);
    const nativeToken = await engine.getNativeTokenInfo(network.id);
    const inputToken = appSelector((s) => s.swap.inputToken);
    if (nativeToken && !inputToken) {
      this.setInputToken(nativeToken);
    }
    const outputToken = appSelector((s) => s.swap.outputToken);
    if (!outputToken) {
      const token = formatServerToken(USDC);
      this.setOutputToken({ ...token, coingeckoId: 'usd-coin' });
    }
  }

  @backgroundMethod()
  async setOutputToken(token: Token) {
    const { appSelector } = this.backgroundApi;
    const outputToken = appSelector((s) => s.swap.outputToken);
    const inputToken = appSelector((s) => s.swap.inputToken);
    if (
      inputToken &&
      inputToken.networkId === token.networkId &&
      inputToken.tokenIdOnNetwork === token.tokenIdOnNetwork
    ) {
      if (getActiveWalletAccount().networkId !== outputToken?.networkId) {
        this.selectToken('INPUT');
      } else {
        this.selectToken(
          'INPUT',
          this.getNetwork(outputToken?.networkId),
          outputToken,
        );
      }
    }
    const tokenNetwork = this.getNetwork(token.networkId);
    this.selectToken('OUTPUT', tokenNetwork, token);
    if (tokenNetwork) {
      this.setRecipient(tokenNetwork);
    }
  }

  @backgroundMethod()
  async switchTokens() {
    const { dispatch, appSelector, engine } = this.backgroundApi;
    const outputToken = appSelector((s) => s.swap.outputToken);
    const inputToken = appSelector((s) => s.swap.inputToken);
    dispatch(setQuote(undefined), setResponses(undefined), switchTokens());
    if (outputToken) {
      const network = await engine.getNetwork(outputToken.networkId);
      this.setSendingAccountByNetwork(network);
    }
    if (inputToken) {
      const network = await engine.getNetwork(inputToken.networkId);
      this.setRecipient(network);
    }
  }

  @backgroundMethod()
  async resetState() {
    const { dispatch } = this.backgroundApi;
    dispatch(resetState());
  }

  @backgroundMethod()
  async userInput(field: FieldType, typedValue: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(setTypedValue({ independentField: field, typedValue }));
  }

  @backgroundMethod()
  async resetTypedValue() {
    const { dispatch } = this.backgroundApi;
    dispatch(resetTypedValue());
  }

  @backgroundMethod()
  async clearState() {
    const { dispatch } = this.backgroundApi;
    dispatch(clearState());
  }

  @backgroundMethod()
  async clearTransactions() {
    const { dispatch } = this.backgroundApi;
    dispatch(clearTransactions());
  }

  @backgroundMethod()
  async setQuote(data?: QuoteData) {
    const { dispatch } = this.backgroundApi;
    const actions: any[] = [setQuote(data)];
    dispatch(...actions);
  }

  @backgroundMethod()
  async refreshParams(params: FetchQuoteParams | undefined) {
    const quote = this.backgroundApi.appSelector((s) => s.swap.quote);
    let result = false;
    if (this.prevParams) {
      const hash = JSON.stringify(params);
      const prevHash = JSON.stringify(this.prevParams);
      result = hash === prevHash && !!quote;
    }
    this.prevParams = params;
    return result;
  }

  @backgroundMethod()
  async setQuoteLimited(limited?: QuoteLimited) {
    const { dispatch } = this.backgroundApi;
    dispatch(setQuoteLimited(limited));
  }

  @backgroundMethod()
  async getSwapInputToken() {
    const { appSelector } = this.backgroundApi;
    const inputToken = appSelector((s) => s.swap.inputToken);
    return inputToken;
  }

  @backgroundMethod()
  async setRecipient(network: Network): Promise<Recipient | undefined> {
    const { dispatch, appSelector, engine } = this.backgroundApi;
    const recipient = appSelector((s) => s.swap.recipient);
    if (recipient?.address && recipient.networkImpl === network.impl) {
      return recipient;
    }
    const { wallets, networks } = appSelector((s) => s.runtime);
    const { activeNetworkId, activeWalletId, activeAccountId } = appSelector(
      (s) => s.general,
    );
    const activeWallet = wallets.find((item) => item.id === activeWalletId);
    const activeNetwork = networks.find((item) => item.id === activeNetworkId);
    if (!activeWallet || !activeNetwork) {
      return;
    }
    const accounts = await engine.getAccounts(
      activeWallet.accounts,
      network.id,
    );
    const account =
      network.impl === activeNetwork.impl
        ? accounts.find((acc) => acc.id === activeAccountId)
        : accounts[0];
    if (account) {
      const data = {
        address: account.address,
        name: account.name,
        accountId: account.id,
        networkId: network.id,
        networkImpl: network.impl,
      };
      dispatch(setRecipient(data));
      return data;
    }
    dispatch(setRecipient());
  }

  @backgroundMethod()
  async refreshSendingAccount() {
    const { appSelector, engine } = this.backgroundApi;
    const sendingAccount = appSelector((s) => s.swap.sendingAccount);
    if (sendingAccount !== null) {
      return;
    }
    const inputToken = appSelector((s) => s.swap.inputToken);
    if (!inputToken) {
      return;
    }
    const network = await engine.getNetwork(inputToken.networkId);
    this.setSendingAccountByNetwork(network);
  }

  @backgroundMethod()
  async handleAccountRemoved(account: Account) {
    const { appSelector, dispatch } = this.backgroundApi;
    const sendingAccount = appSelector((s) => s.swap.sendingAccount);
    if (sendingAccount && sendingAccount.id === account.id) {
      dispatch(setSendingAccount(undefined));
    }
    const recipient = appSelector((s) => s.swap.recipient);
    if (recipient && recipient?.accountId === account.id) {
      dispatch(setRecipient(undefined));
    }
  }

  @backgroundMethod()
  async setSendingAccountByNetwork(
    network?: Network,
  ): Promise<Account | undefined> {
    if (!network) {
      return;
    }
    const { dispatch, appSelector, engine } = this.backgroundApi;
    const sendingAccount = appSelector((s) => s.swap.sendingAccount);
    if (
      sendingAccount &&
      isAccountCompatibleWithNetwork(sendingAccount.id, network.id)
    ) {
      return sendingAccount;
    }
    const wallets = appSelector((s) => s.runtime.wallets);
    const { networks } = appSelector((s) => s.runtime);
    const { activeNetworkId, activeWalletId, activeAccountId } = appSelector(
      (s) => s.general,
    );
    const activeWallet = wallets.find((item) => item.id === activeWalletId);
    const activeNetwork = networks.find((item) => item.id === activeNetworkId);
    if (!activeWallet || !activeNetwork) {
      return;
    }
    const accounts = await engine.getAccounts(
      activeWallet.accounts,
      network.id,
    );
    const account =
      network.impl === activeNetwork.impl
        ? accounts.find((acc) => acc.id === activeAccountId)
        : accounts[0];
    if (account) {
      const data = { ...account, impl: network.impl };
      dispatch(setSendingAccount(data));
      return data;
    }

    const inactiveWallets = wallets.filter(
      (wallet) => wallet.id !== activeAccountId,
    );
    if (inactiveWallets.length === 0) {
      return;
    }

    for (let i = 0; i < inactiveWallets.length; i += 1) {
      const wallet = inactiveWallets[i];
      const items = await engine.getAccounts(wallet.accounts, network.id);
      if (items.length > 0) {
        dispatch(setSendingAccount(items[0]));
        return;
      }
    }

    dispatch(setSendingAccount(null));
  }

  @backgroundMethod()
  async getAccountRelatedWallet(accountId: string) {
    const { appSelector } = this.backgroundApi;
    const wallets = appSelector((s) => s.runtime.wallets);
    for (let i = 0; i < wallets.length; i += 1) {
      const wallet = wallets[0];
      const { accounts } = wallet;
      if (accounts.includes(accountId)) {
        return wallet;
      }
    }
  }

  @backgroundMethod()
  async searchTokens({
    networkId,
    keyword,
  }: {
    networkId?: string;
    keyword?: string;
  }) {
    const { engine, appSelector } = this.backgroundApi;
    const networks = appSelector((s) => s.runtime.networks);
    if (!keyword || !keyword.trim()) {
      return [];
    }
    const term = keyword.trim();
    const tokens = await engine.searchTokens(networkId, term, 1);
    const networkIds = networks.map((item) => item.id);
    return tokens.filter((t) => networkIds.includes(t.networkId));
  }

  @backgroundMethod()
  async checkAccountInWallets(accountId: string) {
    const { appSelector } = this.backgroundApi;
    const wallets = appSelector((s) => s.runtime.wallets);
    for (let i = 0; i < wallets.length; i += 1) {
      const wallet = wallets[i];
      if (wallet.accounts.includes(accountId)) {
        return true;
      }
    }
    return false;
  }

  @backgroundMethod()
  async initSwap() {
    const { appSelector, dispatch } = this.backgroundApi;
    const slippage = appSelector((s) => s.swapTransactions.slippage);
    if (!slippage) {
      dispatch(setSlippage({ mode: 'auto' }));
    }
  }

  @backgroundMethod()
  async getSwapConfig() {
    const { dispatch } = this.backgroundApi;
    const endpoint = await this.getServerEndPoint();
    const url = `${endpoint}/swap/config`;
    const res = await this.client.get(url);
    const { data } = res;
    const actions: any[] = [];
    if (data) {
      const { tokens, coingeckoIds, recommendedSlippage } = data;
      if (tokens) {
        if (tokens && Array.isArray(tokens)) {
          const items = tokens.map((item) => ({
            ...item,
            tokens: item.tokens.map((o: any) => formatServerToken(o)),
          }));
          actions.push(updateTokenList(items));
        }
      }
      if (coingeckoIds) {
        const coingeckoIdsData: Record<string, string[]> = {};
        if (coingeckoIds.popular && Array.isArray(coingeckoIds.popular)) {
          coingeckoIdsData.popular = coingeckoIds.popular;
        }
        if (coingeckoIds.stable && Array.isArray(coingeckoIds.stable)) {
          coingeckoIdsData.stable = coingeckoIds.stable;
        }
        actions.push(setCoingeckoIds(coingeckoIdsData));
      }
      if (recommendedSlippage) {
        actions.push(setRecommendedSlippage(recommendedSlippage));
      }
    }
    if (actions.length > 0) {
      dispatch(...actions);
    }
  }

  @backgroundMethod()
  async getSwapTokens() {
    const { dispatch } = this.backgroundApi;
    const endpoint = await this.getServerEndPoint();
    const url = `${endpoint}/swap/tokens`;
    const res = await this.client.get(url);
    const { data } = res;
    if (data && Array.isArray(data)) {
      const items = data.map((item) => ({
        ...item,
        tokens: item.tokens.map((o: any) => formatServerToken(o)),
      }));
      dispatch(updateTokenList(items));
    }
  }

  @backgroundMethod()
  async setShowMoreQuoteDetail(show: boolean) {
    const { dispatch } = this.backgroundApi;
    dispatch(setShowMoreQuoteDetail(show));
  }

  @backgroundMethod()
  async recipientIsUnknown(recipient?: Recipient) {
    if (!recipient) {
      return false;
    }
    if (!recipient.accountId) {
      return true;
    }
    const { appSelector } = this.backgroundApi;
    const wallets = appSelector((s) => s.runtime.wallets);
    const watchingWallet = wallets.find((wallet) => wallet.type === 'watching');
    if (watchingWallet) {
      return watchingWallet.accounts.includes(recipient.accountId);
    }
    return false;
  }

  @backgroundMethod()
  async setSwapWelcomeShown(value: boolean) {
    simpleDb.setting.setSwapWelcomeShown(value);
  }

  @backgroundMethod()
  async getSwapWelcomeShown() {
    return simpleDb.setting.getSwapWelcomeShown();
  }

  @backgroundMethod()
  async setSwapReceivingUnknownShown(value: boolean) {
    simpleDb.setting.setSwapReceivingUnknownShown(value);
  }

  @backgroundMethod()
  async getSwapReceivingUnknownShown() {
    return simpleDb.setting.getSwapReceivingUnknownShown();
  }

  @backgroundMethod()
  async getSwapReceivingIsNotSendingAccountShown() {
    return simpleDb.setting.getSwapReceivingIsNotSendingAccountShown();
  }

  @backgroundMethod()
  async setSwapReceivingIsNotSendingAccountShown(value: boolean) {
    return simpleDb.setting.setSwapReceivingIsNotSendingAccountShown(value);
  }

  @backgroundMethod()
  async getSwapPriceImpactShown() {
    return simpleDb.setting.getSwapPriceImpactShown();
  }

  @backgroundMethod()
  async setSwapPriceImpactShown(value: boolean) {
    return simpleDb.setting.setSwapPriceImpactShown(value);
  }

  @backgroundMethod()
  async setSwapChartMode(mode: string) {
    return this.backgroundApi.dispatch(setSwapChartMode(mode));
  }

  @backgroundMethod()
  async setSwapFeePresetIndex(value: string) {
    return this.backgroundApi.dispatch(setSwapFeePresetIndex(value));
  }

  @backgroundMethod()
  async getSwapFeePresetIndex() {
    return this.backgroundApi.appSelector(
      (s) => s.swapTransactions.swapFeePresetIndex,
    );
  }

  @backgroundMethod()
  async setUserSelectedQuoter(hash: string, type: string) {
    return this.backgroundApi.dispatch(setUserSelectedQuoter({ hash, type }));
  }

  @backgroundMethod()
  async clearUserSelectedQuoter() {
    return this.backgroundApi.dispatch(clearUserSelectedQuoter());
  }

  @backgroundMethod()
  async getCurrentUserSelectedQuoter() {
    const { appSelector } = this.backgroundApi;
    const userSelectedQuoter = appSelector((s) => s.swap.userSelectedQuoter);
    if (!userSelectedQuoter) {
      return undefined;
    }
    const inputToken = appSelector((s) => s.swap.inputToken);
    const outputToken = appSelector((s) => s.swap.outputToken);
    const hash = stringifyTokens(inputToken, outputToken);
    if (!hash) {
      return undefined;
    }
    return userSelectedQuoter[hash];
  }

  @backgroundMethod()
  async sendTransaction(params: {
    accountId: string;
    networkId: string;
    encodedTx: IEncodedTx;
    payload?: SendConfirmParams['payloadInfo'];
    autoFallback?: boolean;
  }) {
    const { accountId, networkId, encodedTx, payload, autoFallback } = params;
    const { appSelector, serviceTransaction } = this.backgroundApi;
    const swapFeePresetIndex = appSelector(
      (s) => s.swapTransactions.swapFeePresetIndex,
    );
    return serviceTransaction.sendTransaction({
      accountId,
      networkId,
      encodedTx,
      payload,
      feePresetIndex: swapFeePresetIndex,
      autoFallback,
    });
  }

  @backgroundMethod()
  async getSwapError() {
    const { appSelector } = this.backgroundApi;
    return appSelector((s) => s.swap.error);
  }

  @backgroundMethod()
  async getCurrentSwapSlippageStatus() {
    const { appSelector } = this.backgroundApi;
    const inputToken = appSelector((s) => s.swap.inputToken);
    const outputToken = appSelector((s) => s.swap.outputToken);
    const slippage = appSelector((s) => s.swapTransactions.slippage);
    const recommendedSlippage = appSelector(
      (s) => s.swapTransactions.recommendedSlippage,
    );
    const coingeckoIds = appSelector((s) => s.swapTransactions.coingeckoIds);

    const defaultSlippage = '1';
    const getSlippageByCoingeckoId = (coingeckoId?: string) => {
      if (!coingeckoIds || !recommendedSlippage || !coingeckoId) {
        return defaultSlippage;
      }
      const { popular, stable, others } = recommendedSlippage;
      const { popular: popularCoingeckoIds, stable: stableCoingeckoIds } =
        coingeckoIds;
      if (stableCoingeckoIds && stableCoingeckoIds.includes(coingeckoId)) {
        return stable || defaultSlippage;
      }
      if (popularCoingeckoIds && popularCoingeckoIds.includes(coingeckoId)) {
        return popular || defaultSlippage;
      }
      return others || defaultSlippage;
    };

    const autoMode = !slippage || slippage.mode === 'auto';
    let value = defaultSlippage;
    if (autoMode) {
      if (inputToken && outputToken) {
        const inputSlippage = getSlippageByCoingeckoId(inputToken.coingeckoId);
        const outputSlippage = getSlippageByCoingeckoId(
          outputToken.coingeckoId,
        );
        value =
          Number(inputSlippage) > Number(outputSlippage)
            ? inputSlippage
            : outputSlippage;
      }
    } else if (slippage.value) {
      value = slippage.value;
    }
    return value || defaultSlippage;
  }

  @backgroundMethod()
  async fetchSwapTokenBalance(params: {
    networkId?: string;
    accountId?: string;
  }) {
    const { networkId, accountId } = params;
    if (!networkId || !accountId) {
      return;
    }
    const isMatch = isAccountCompatibleWithNetwork(accountId, networkId);
    if (!isMatch) {
      return;
    }
    const { appSelector } = this.backgroundApi;
    const tokenList = appSelector((s) => s.swapTransactions.tokenList);
    if (!tokenList) {
      return;
    }
    const data = tokenList.find((item) => item.networkId === networkId);
    const tokensA = data?.tokens ?? [];
    const accountTokens = appSelector((s) => s.tokens.accountTokens);
    const tokensB = accountTokens?.[networkId]?.[accountId] ?? [];

    let tokens = [...tokensA, ...tokensB];
    const set = new Set();

    tokens = tokens.filter((item) => {
      if (set.has(item.tokenIdOnNetwork)) {
        return false;
      }
      set.add(item.tokenIdOnNetwork);
      return true;
    });

    const { serviceToken } = this.backgroundApi;

    serviceToken.fetchTokenBalance({
      activeAccountId: accountId,
      activeNetworkId: networkId,
      tokenIds: tokens.map((token) => token.tokenIdOnNetwork),
    });
  }

  @backgroundMethod()
  resetSwapSlippage() {
    const { appSelector, dispatch } = this.backgroundApi;
    const slippage = appSelector((s) => s.swapTransactions.slippage);
    if (slippage && slippage.autoReset) {
      dispatch(setSlippage({ mode: 'auto' }));
    }
  }

  @bindThis()
  async refreshSelectedTokenPrice() {
    const { appSelector, servicePrice } = this.backgroundApi;
    const { inputToken, inputTokenNetwork, outputToken, outputTokenNetwork } =
      appSelector((s) => s.swap ?? {});
    const activeNetworkId = appSelector((s) => s.general.activeNetworkId);
    const inputNetworkId = inputTokenNetwork?.id ?? inputToken?.networkId ?? '';
    const outputNetworkId =
      outputTokenNetwork?.id ?? outputToken?.networkId ?? '';
    if (inputNetworkId !== activeNetworkId) {
      await servicePrice.getSimpleTokenPrice({
        networkId: inputNetworkId,
        tokenId: inputToken?.tokenIdOnNetwork ?? '',
      });
    }
    if (outputNetworkId !== activeNetworkId) {
      await servicePrice.getSimpleTokenPrice({
        networkId: outputNetworkId,
        tokenId: outputToken?.tokenIdOnNetwork ?? '',
      });
    }
  }
}
