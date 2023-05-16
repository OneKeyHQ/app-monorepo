/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import {
  resetState,
  setActiveAccount,
  setInstantRate,
  setMktRate,
  setProgressStatus,
  setTokenIn,
  setTokenOut,
  setTypedPrice,
  setTypedValue,
} from '@onekeyhq/kit/src/store/reducers/limitOrder';
import {
  deleteLimitOrderTransaction,
  resetLimitOrderTransactions,
  updateLimitOrderTransaction,
} from '@onekeyhq/kit/src/store/reducers/swapTransactions';
import {
  WETH9,
  limitOrderNetworkIds,
  wToken,
} from '@onekeyhq/kit/src/views/Swap/config';
import type {
  ILimitOrderQuoteParams,
  LimitOrder,
  LimitOrderDetailsResponse,
  LimitOrderTransactionDetails,
  ProgressStatus,
} from '@onekeyhq/kit/src/views/Swap/typings';
import {
  div,
  formatAmount,
  formatAmountExact,
  getChainIdFromNetworkId,
  getTokenAmountString,
  getTokenAmountValue,
  multiply,
  tokenEqual,
} from '@onekeyhq/kit/src/views/Swap/utils';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import ServiceBase from './ServiceBase';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

const EIP712_DOMAIN_PARAMETERS = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

const LIMIT_ORDER_PARAMETERS = [
  { type: 'address', name: 'makerToken' },
  { type: 'address', name: 'takerToken' },
  { type: 'uint128', name: 'makerAmount' },
  { type: 'uint128', name: 'takerAmount' },
  { type: 'uint128', name: 'takerTokenFeeAmount' },
  { type: 'address', name: 'maker' },
  { type: 'address', name: 'taker' },
  { type: 'address', name: 'sender' },
  { type: 'address', name: 'feeRecipient' },
  { type: 'bytes32', name: 'pool' },
  { type: 'uint64', name: 'expiry' },
  { type: 'uint256', name: 'salt' },
];

const EXCHANGE_PROXY_EIP712_DOMAIN_DEFAULT = {
  chainId: 1,
  verifyingContract: NULL_ADDRESS,
  name: 'ZeroEx',
  version: '1.0.0',
};

export function createExchangeProxyEIP712Domain(
  chainId?: number,
  verifyingContract?: string,
): EIP712Domain {
  return {
    ...EXCHANGE_PROXY_EIP712_DOMAIN_DEFAULT,
    ...(chainId ? { chainId } : {}),
    ...(verifyingContract ? { verifyingContract } : {}),
  };
}

type EIP712DomainTypedDataParams = {
  chainId?: number;
  networkId: string;
};

type EIP712MessageTypedDataParams = {
  makerToken: string;
  takerToken: string;
  makerAmount: string;
  takerAmount: string;
  takerTokenFeeAmount: string;
  maker: string;
  taker: string;
  sender: string;
  feeRecipient: string;
  pool: string;
  expiry: string;
  salt: string;
};

type EIP712TypedDataParams = {
  domain: EIP712DomainTypedDataParams;
  message: EIP712MessageTypedDataParams;
};

type SubmitLimitOrderParams = {
  order: LimitOrder;
  signature: string;
  networkId: string;
};

type BuildLimitOrderParams = {
  params: ILimitOrderQuoteParams;
  instantRate: string;
};

type FetchLimitOrderParams = {
  networkId: string;
  orderHash: string;
};

const verifyingContract = '0xdef1c0ded9bec7f1a1670819833240f027b25eff';

@backgroundClass()
class ServiceLimitOrder extends ServiceBase {
  @backgroundMethod()
  async getEIP712TypedData({ domain, message }: EIP712TypedDataParams) {
    const { networkId } = domain;
    const chainId = getChainIdFromNetworkId(networkId);
    return {
      types: {
        EIP712Domain: EIP712_DOMAIN_PARAMETERS,
        LimitOrder: LIMIT_ORDER_PARAMETERS,
      },
      domain: createExchangeProxyEIP712Domain(
        Number(chainId),
        verifyingContract,
      ),
      primaryType: 'LimitOrder',
      message: {
        makerToken: message.makerToken,
        takerToken: message.takerToken,
        makerAmount: message.makerAmount,
        takerAmount: message.takerAmount,
        takerTokenFeeAmount: message.takerTokenFeeAmount,
        maker: message.maker,
        taker: message.taker,
        sender: message.sender,
        feeRecipient: message.feeRecipient,
        pool: message.pool,
        expiry: message.expiry,
        salt: message.salt,
      },
    };
  }

  getServerEndPoint() {
    return getFiatEndpoint();
  }

  @backgroundMethod()
  async setDefaultTokens() {
    const { appSelector } = this.backgroundApi;
    const inputToken = appSelector((s) => s.swap.inputToken);
    const typedValue = appSelector((s) => s.swap.typedValue);
    let limitOrderInputToken: Token = WETH9[OnekeyNetwork.eth];
    if (inputToken && limitOrderNetworkIds.includes(inputToken.networkId)) {
      limitOrderInputToken = wToken(inputToken);
    }

    this.setInputToken(limitOrderInputToken);
    this.setSmartOutput(limitOrderInputToken);
    this.userInputValue(typedValue);
  }

  @backgroundMethod()
  async setSmartOutput(inputToken: Token) {
    if (!limitOrderNetworkIds.includes(inputToken.networkId)) {
      return;
    }
    const { appSelector, serviceSwap } = this.backgroundApi;
    const tokenOut = appSelector((s) => s.limitOrder.tokenOut);
    if (
      tokenOut?.networkId === inputToken.networkId &&
      tokenOut.tokenIdOnNetwork.toLowerCase() !==
        inputToken.tokenIdOnNetwork.toLowerCase()
    ) {
      return;
    }
    let limitOrderOutputToken: Token | undefined;
    const paymentToken = await serviceSwap.getPaymentToken(inputToken);
    const weth = WETH9[inputToken.networkId];
    if (paymentToken) {
      if (tokenEqual(inputToken, paymentToken)) {
        limitOrderOutputToken = weth;
      } else {
        limitOrderOutputToken = paymentToken;
      }
    }
    if (
      limitOrderOutputToken &&
      limitOrderOutputToken.networkId === inputToken.networkId
    ) {
      this.setOutputToken(limitOrderOutputToken);
    }
  }

  @backgroundMethod()
  async setInputToken(newToken: Token) {
    const { appSelector, dispatch } = this.backgroundApi;
    const tokenOut = appSelector((s) => s.limitOrder.tokenOut);
    const tokenIn = appSelector((s) => s.limitOrder.tokenIn);
    if (tokenIn && tokenEqual(tokenIn, newToken)) {
      return;
    }
    const limitOrderInputToken = wToken(newToken);
    dispatch(setTokenIn(limitOrderInputToken));
    if (limitOrderInputToken.networkId === tokenIn?.networkId) {
      if (
        tokenOut &&
        tokenOut.networkId === limitOrderInputToken.networkId &&
        tokenOut.tokenIdOnNetwork === limitOrderInputToken.tokenIdOnNetwork
      ) {
        dispatch(setTokenOut(tokenIn));
      }
    } else {
      this.setSmartOutput(limitOrderInputToken);
    }
    this.setSendingAccountByNetwork(
      this.getNetwork(limitOrderInputToken.networkId),
    );
  }

  @backgroundMethod()
  async setOutputToken(newToken: Token) {
    const { dispatch, appSelector } = this.backgroundApi;
    const tokenOut = appSelector((s) => s.limitOrder.tokenOut);
    if (tokenOut && tokenEqual(tokenOut, newToken)) {
      return;
    }
    dispatch(setTokenOut(newToken));
  }

  @backgroundMethod()
  async resetState() {
    const { dispatch } = this.backgroundApi;
    dispatch(resetState());
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
  async setSendingAccountByNetwork(network?: Network) {
    if (!network) {
      return;
    }
    const { dispatch, appSelector, engine } = this.backgroundApi;
    const sendingAccount = appSelector((s) => s.limitOrder.activeAccount);
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
      dispatch(setActiveAccount(data));
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
        dispatch(setActiveAccount(items[0]));
        return;
      }
    }
    dispatch(setActiveAccount(null));
  }

  @backgroundMethod()
  async switchTokens() {
    const { dispatch, appSelector } = this.backgroundApi;
    const outputToken = appSelector((s) => s.limitOrder.tokenOut);
    const inputToken = appSelector((s) => s.limitOrder.tokenIn);
    dispatch(setTokenIn(outputToken), setTokenOut(inputToken));
  }

  @backgroundMethod()
  userInputValue(value: string) {
    const { dispatch } = this.backgroundApi;
    dispatch(setTypedValue(value));
  }

  @backgroundMethod()
  async buildLimitOrder({
    params,
    instantRate,
  }: BuildLimitOrderParams): Promise<LimitOrder | undefined> {
    const { appSelector } = this.backgroundApi;
    const { activeAccount, tokenIn, tokenOut, tokenInValue } = params;
    const expireIn = appSelector((s) => s.limitOrder.expireIn);
    if (activeAccount && tokenIn && tokenOut && tokenInValue && instantRate) {
      const makerAmount = getTokenAmountString(tokenIn, tokenInValue);
      const takerAmount = getTokenAmountString(
        tokenOut,
        multiply(tokenInValue, instantRate),
      );
      const order: LimitOrder = {
        maker: activeAccount.address,
        taker: NULL_ADDRESS,
        makerToken: tokenIn.tokenIdOnNetwork,
        takerToken: tokenOut.tokenIdOnNetwork,
        makerAmount,
        takerAmount,
        salt: String(Date.now()),
        pool: '0x0000000000000000000000000000000000000000000000000000000000000000',
        sender: NULL_ADDRESS,
        takerTokenFeeAmount: '',
        feeRecipient: '',
        expiry: String(Math.floor(Date.now() / 1000) + expireIn * 60),
      };
      const baseURL = this.getServerEndPoint();
      const url = `${baseURL}/limit_order/config_order`;
      const res = await this.client.post(url, { data: order });
      return res.data;
    }
    return undefined;
  }

  @backgroundMethod()
  async submitLimitOrder(params: SubmitLimitOrderParams) {
    const { signature, order, networkId } = params;
    const r = `0x${signature.substring(2).substring(0, 64)}`;
    const s = `0x${signature.substring(2).substring(64, 128)}`;
    const v = parseInt(signature.substring(2).substring(128, 130), 16);
    const chainId = getChainIdFromNetworkId(networkId);

    const data = {
      ...order,
      chainId: Number(chainId),
      verifyingContract,
      signature: {
        v,
        s,
        r,
        signatureType: 2,
      },
    };

    const baseURL = this.getServerEndPoint();
    const url = `${baseURL}/limit_order/submit_order`;
    const res = await this.client.post(url, { networkId, data });
    return res.data;
  }

  @backgroundMethod()
  async fetchOrderState({ networkId, orderHash }: FetchLimitOrderParams) {
    const baseURL = this.getServerEndPoint();
    const url = `${baseURL}/limit_order/order_details`;
    const res = await this.client.get(url, {
      params: { networkId, orderHash },
    });
    return res.data as LimitOrderDetailsResponse;
  }

  @backgroundMethod()
  async buildCancelLimitOrderTx(data: LimitOrder) {
    const baseURL = this.getServerEndPoint();
    const url = `${baseURL}/limit_order/build_cancel_tx`;
    const res = await this.client.post(url, { data });
    return { data: res.data as string, to: verifyingContract };
  }

  @backgroundMethod()
  async fetchAccountLimitOrderList({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<LimitOrderDetailsResponse[]> {
    const { engine } = this.backgroundApi;
    const acc = await engine.getAccount(accountId, networkId);
    const baseURL = this.getServerEndPoint();
    const url = `${baseURL}/limit_order/query_orders`;
    const res = await this.client.get(url, {
      params: { networkId, maker: acc.address },
    });
    return res.data?.records ?? ([] as LimitOrderDetailsResponse[]);
  }

  async formatResponseToLimitOrder({
    response,
    accountId,
    networkId,
  }: {
    response: LimitOrderDetailsResponse;
    accountId: string;
    networkId: string;
  }) {
    const { makerToken, takerToken } = response.order;
    const { serviceToken } = this.backgroundApi;
    const tokenDetails = await serviceToken.batchTokenDetail(networkId, [
      makerToken,
      takerToken,
    ]);

    const tokenIn = tokenDetails[makerToken];
    const tokenOut = tokenDetails[takerToken];
    const { makerAmount } = response.order;
    const { takerAmount } = response.order;
    const tokenInValue = getTokenAmountValue(tokenIn, makerAmount);
    const tokenOutValue = getTokenAmountValue(tokenOut, takerAmount);

    const details: LimitOrderTransactionDetails = {
      orderHash: response.metaData.orderHash,
      accountId,
      networkId,
      tokenIn,
      tokenInValue: makerAmount,
      tokenOut,
      tokenOutValue: takerAmount,
      remainingFillable: response.metaData.remainingFillableTakerAmount,
      createdAt: Math.floor(
        new Date(response.metaData.createdAt).getTime() / 1000,
      ),
      expiredIn: Number(response.order.expiry),
      rate: formatAmount(div(tokenOutValue, tokenInValue)),
    };
    return details;
  }

  @backgroundMethod()
  async syncAccountOrders({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const { dispatch } = this.backgroundApi;
    const responses = await this.fetchAccountLimitOrderList({
      networkId,
      accountId,
    });

    const allPromises: Promise<
      | { status: 'fulfilled'; value: LimitOrderTransactionDetails }
      | { status: 'rejected'; reason: string }
    >[] = responses.map((response) => {
      const p = this.formatResponseToLimitOrder({
        response,
        networkId,
        accountId,
      });
      return p
        .then((value) => ({
          status: 'fulfilled' as const,
          value,
        }))
        .catch((reason: string) => ({
          status: 'rejected' as const,
          reason,
        }));
    });

    const allPromiseRes = await Promise.all(allPromises);

    const allFilteredPromiseRes = allPromiseRes.filter(
      (s) => s.status === 'fulfilled',
    ) as { status: 'fulfilled'; value: LimitOrderTransactionDetails }[];
    const limitOrders = allFilteredPromiseRes.map((res) => res.value);

    dispatch(
      resetLimitOrderTransactions({ networkId, accountId, limitOrders }),
    );
  }

  @backgroundMethod()
  async syncAccount({ accountId }: { accountId: string }) {
    this.syncAccountOrders({ networkId: OnekeyNetwork.eth, accountId });
    this.syncAccountOrders({ networkId: OnekeyNetwork.bsc, accountId });
    this.syncAccountOrders({ networkId: OnekeyNetwork.polygon, accountId });
  }

  @backgroundMethod()
  async queryOrderStateProcess(details: LimitOrderTransactionDetails) {
    const { networkId, orderHash, accountId } = details;
    const { dispatch, serviceToken } = this.backgroundApi;
    try {
      const orderState = await this.fetchOrderState({ networkId, orderHash });
      dispatch(
        updateLimitOrderTransaction({
          accountId: details.accountId,
          networkId: details.networkId,
          orderHash,
          details: {
            remainingFillable: orderState.metaData.remainingFillableTakerAmount,
          },
        }),
      );
    } catch {
      const orders = await this.fetchAccountLimitOrderList({
        networkId,
        accountId,
      });
      const orderHashs = orders.map((i) => i.metaData.orderHash);
      if (
        !orderHashs ||
        orderHashs.length === 0 ||
        !orderHashs.includes(orderHash)
      ) {
        dispatch(
          deleteLimitOrderTransaction({
            accountId: details.accountId,
            networkId: details.networkId,
            orderHash,
          }),
        );
        serviceToken.getAccountTokenBalance({
          accountId: details.accountId,
          networkId: details.networkId,
          tokenIds: [details.tokenIn.tokenIdOnNetwork],
        });
      }
    }
  }

  isStableToken(token: Token) {
    const address = token.tokenIdOnNetwork.toLowerCase();
    if (token.networkId === OnekeyNetwork.eth) {
      const tokens = [
        '0xdac17f958d2ee523a2206206994597c13d831ec7',
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      ];
      return tokens.includes(address);
    }
    if (token.networkId === OnekeyNetwork.bsc) {
      const tokens = [
        '0x55d398326f99059ff775485246999027b3197955',
        '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      ];
      return tokens.includes(address);
    }
    if (token.networkId === OnekeyNetwork.polygon) {
      const tokens = [
        '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
      ];
      return tokens.includes(address);
    }
    return false;
  }

  @backgroundMethod()
  async setRate(rate: string) {
    const { dispatch, appSelector } = this.backgroundApi;
    const actions: any[] = [setMktRate(rate)];
    const instantRate = appSelector((s) => s.limitOrder.instantRate);
    if (!instantRate) {
      const tokenIn = appSelector((s) => s.limitOrder.tokenIn);
      if (tokenIn && this.isStableToken(tokenIn)) {
        const newRate = formatAmountExact(div(1, rate));
        actions.push(
          setInstantRate(rate),
          setTypedPrice({ value: newRate, reversed: true }),
        );
      } else {
        actions.push(setInstantRate(rate), setTypedPrice({ value: rate }));
      }
    }
    dispatch(...actions);
  }

  @backgroundMethod()
  async setProgressStatus(data?: ProgressStatus) {
    const { dispatch, appSelector } = this.backgroundApi;
    const progressStatus = appSelector((s) => s.limitOrder.progressStatus);
    if (!progressStatus) {
      return;
    }
    dispatch(setProgressStatus(data));
  }

  @backgroundMethod()
  async openProgressStatus() {
    const { dispatch } = this.backgroundApi;
    dispatch(setProgressStatus({}));
  }

  @backgroundMethod()
  async closeProgressStatus() {
    const { dispatch } = this.backgroundApi;
    dispatch(setProgressStatus(undefined));
  }
}

export default ServiceLimitOrder;
