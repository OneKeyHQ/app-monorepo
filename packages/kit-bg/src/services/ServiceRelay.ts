import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type {
  IRelayChain,
  IRelayChainsResponse,
  IRelayCurrency,
  IRelayDepositInfo,
  IRelayQuoteRequest,
  IRelayQuoteResponse,
  IRelayQuoteStep,
} from '@onekeyhq/shared/types/relay';

import ServiceBase from './ServiceBase';

// --- Relay protocol constants ---
const RELAY_API_BASE = 'https://api.relay.link';
const HYPERLIQUID_CHAIN_ID = 1337;
const HYPERLIQUID_DESTINATION_CURRENCY = '0x00000000000000000000000000000000';
const DEFAULT_ORIGIN_DECIMALS = 18;
const MAX_EXACT_INPUT_PROBE_AMOUNT = '10000000';

type IRelayQuoteParams = {
  originChainId: number;
  originCurrency: string;
  recipient: string;
  user?: string;
  refundTo?: string;
  amount: string;
  decimals?: number;
};

type IRelayQuoteRouteParams = Omit<IRelayQuoteParams, 'amount' | 'decimals'>;

type IRelayQuoteRequestParams = IRelayQuoteParams & {
  useDepositAddress?: boolean;
};

@backgroundClass()
class ServiceRelay extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // Curated EVM origins for the first Relay deposit UI. Relay also exposes
  // non-EVM origins, but they need origin-specific refund address UX; using
  // dummy BTC/TRON users would make refunds unsafe.
  private static readonly SUPPORTED_CHAIN_IDS = new Set([
    1, // Ethereum
    10, // Optimism
    56, // BNB Chain
    137, // Polygon
    8453, // Base
    42_161, // Arbitrum
    43_114, // Avalanche
  ]);

  // Major currencies to keep (by symbol, case-insensitive)
  private static readonly SUPPORTED_CURRENCY_SYMBOLS = new Set([
    'usdc',
    'usdt',
    'eth',
    'weth',
    'wbtc',
  ]);

  // Well-known token logos — takes priority over API-provided logoURI
  private static readonly TOKEN_LOGO_MAP: Record<string, string> = {
    eth: 'https://uni.onekey-asset.com/static/chain/eth.png',
    weth: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png',
    wbtc: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0x2260fac5e5542a773aa44fbcfedf7c193bc2c599.png',
    usdt: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xdac17f958d2ee523a2206206994597c13d831ec7.png',
    usdc: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
  };

  private _chainsCache: {
    chains: IRelayChain[];
    currencies: Record<number, IRelayCurrency[]>;
  } | null = null;

  @backgroundMethod()
  async getRelayChains(): Promise<{
    chains: IRelayChain[];
    currencies: Record<number, IRelayCurrency[]>;
  }> {
    if (this._chainsCache) {
      return this._chainsCache;
    }

    const response = await fetch(`${RELAY_API_BASE}/chains`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new OneKeyError({
        message: errorText || 'Failed to load Relay chains',
      });
    }

    const data = (await response.json()) as IRelayChainsResponse;

    const chains: IRelayChain[] = [];
    const currencies: Record<number, IRelayCurrency[]> = {};

    for (const chain of data.chains ?? []) {
      if (
        chain.vmType === 'evm' &&
        ServiceRelay.SUPPORTED_CHAIN_IDS.has(chain.id) &&
        chain.solverCurrencies &&
        chain.solverCurrencies.length > 0
      ) {
        const filteredCurrencies = chain.solverCurrencies.filter((c) =>
          ServiceRelay.SUPPORTED_CURRENCY_SYMBOLS.has(c.symbol.toLowerCase()),
        );
        if (filteredCurrencies.length > 0) {
          chains.push({
            id: chain.id,
            name: chain.displayName || chain.name,
            icon: chain.iconUrl || chain.icon || '',
            vmType: chain.vmType,
          });
          currencies[chain.id] = filteredCurrencies.map((c) => ({
            chainId: c.chainId ?? chain.id,
            address: c.address,
            symbol: c.symbol,
            name: c.name,
            decimals: c.decimals,
            logoURI: ServiceRelay._resolveTokenLogo(
              c.symbol,
              c.logoURI ?? c.metadata?.logoURI ?? '',
              chain.id,
              c.address,
            ),
          }));
        }
      }
    }

    this._chainsCache = { chains, currencies };
    return this._chainsCache;
  }

  /**
   * Resolve token logo: our curated map takes priority, then API logoURI,
   * then a generated URL from the indexer.
   */
  private static _resolveTokenLogo(
    symbol: string,
    apiLogoURI: string,
    chainId: number,
    address: string,
  ): string {
    const key = symbol.toLowerCase();
    return (
      ServiceRelay.TOKEN_LOGO_MAP[key] ||
      apiLogoURI ||
      `https://uni.onekey-asset.com/server-service-indexer/evm--${chainId}/tokens/address-${address}.png`
    );
  }

  private static _isEvmAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private static _assertEvmAddress(address: string, fieldName: string) {
    if (!ServiceRelay._isEvmAddress(address)) {
      throw new OneKeyError({ message: `Invalid Relay ${fieldName} address` });
    }
  }

  private async _validateQuoteRoute(
    params: IRelayQuoteRouteParams,
  ): Promise<IRelayCurrency> {
    const { originChainId, originCurrency, recipient, user, refundTo } = params;

    if (!ServiceRelay.SUPPORTED_CHAIN_IDS.has(originChainId)) {
      throw new OneKeyError({ message: 'Unsupported Relay origin chain' });
    }

    ServiceRelay._assertEvmAddress(recipient, 'recipient');
    ServiceRelay._assertEvmAddress(user ?? refundTo ?? recipient, 'user');
    if (refundTo) {
      ServiceRelay._assertEvmAddress(refundTo, 'refundTo');
    }

    const { currencies } = await this.getRelayChains();
    const currency = currencies[originChainId]?.find(
      (item) =>
        item.address.toLowerCase() === originCurrency.toLowerCase() &&
        ServiceRelay.SUPPORTED_CURRENCY_SYMBOLS.has(item.symbol.toLowerCase()),
    );

    if (!currency) {
      throw new OneKeyError({ message: 'Unsupported Relay origin currency' });
    }

    return currency;
  }

  /**
   * Convert a human-readable amount string to smallest-unit integer string.
   * Uses string splitting instead of floating-point to avoid precision loss.
   */
  private static _toSmallestUnit(amount: string, decimals: number): string {
    const normalizedAmount = amount.trim();
    if (!/^(?:0|[1-9]\d*)(?:\.\d*)?$/.test(normalizedAmount)) {
      throw new OneKeyError({ message: 'Invalid Relay quote amount' });
    }

    const [intPart, decPart = ''] = normalizedAmount.split('.');
    const paddedDec = decPart.slice(0, decimals).padEnd(decimals, '0');
    const raw = `${intPart}${paddedDec}`.replace(/^0+/, '') || '0';
    return raw;
  }

  private _buildQuoteRequest(
    params: IRelayQuoteRequestParams,
  ): IRelayQuoteRequest {
    const { originChainId, originCurrency, recipient, amount } = params;
    const refundTo = params.refundTo ?? recipient;
    const amountInSmallestUnit = ServiceRelay._toSmallestUnit(
      amount,
      params.decimals ?? DEFAULT_ORIGIN_DECIMALS,
    );

    return {
      originChainId,
      destinationChainId: HYPERLIQUID_CHAIN_ID,
      originCurrency,
      destinationCurrency: HYPERLIQUID_DESTINATION_CURRENCY,
      user: params.user ?? refundTo,
      recipient,
      amount: amountInSmallestUnit,
      tradeType: 'EXACT_INPUT',
      useDepositAddress: params.useDepositAddress ?? true,
      refundTo,
    };
  }

  private _parseDepositStep(data: IRelayQuoteResponse): {
    depositAddress: string;
    requestId?: string;
  } {
    for (const step of data.steps ?? []) {
      if (step.depositAddress) {
        return {
          depositAddress: step.depositAddress,
          requestId: ServiceRelay._parseRequestId(step),
        };
      }

      for (const item of step.items ?? []) {
        if (item.data?.depositAddress) {
          return {
            depositAddress: item.data.depositAddress,
            requestId: ServiceRelay._parseRequestId(step),
          };
        }
      }
    }
    return { depositAddress: '' };
  }

  private static _parseRequestId(step: IRelayQuoteStep): string | undefined {
    return step.requestId;
  }

  private _parseMaxAmountFromError(errorText: string): string | null {
    // Error format: "Max amount is $318,361 USD"
    const match = errorText.match(/Max amount is \$?([\d,]+(?:\.\d+)?)/i);
    if (match?.[1]) {
      return match[1].replace(/,/g, '');
    }
    return null;
  }

  private async _fetchQuote(
    requestBody: IRelayQuoteRequest,
  ): Promise<IRelayQuoteResponse> {
    const response = await fetch(`${RELAY_API_BASE}/quote/v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OneKeyError({ message: errorText });
    }

    return (await response.json()) as IRelayQuoteResponse;
  }

  private _buildDepositInfo(
    data: IRelayQuoteResponse,
    fallbackAmount: string,
  ): Omit<IRelayDepositInfo, 'maxReceiveAmount'> {
    const { depositAddress, requestId } = this._parseDepositStep(data);
    if (!depositAddress) {
      throw new OneKeyError({
        message: 'No deposit address found in relay quote response',
      });
    }

    const totalFeeUsd = (
      parseFloat(data.fees?.gas?.amountUsd ?? '0') +
      parseFloat(data.fees?.relayer?.amountUsd ?? '0')
    ).toFixed(2);

    return {
      depositAddress,
      requestId,
      sendAmount: data.details?.currencyIn?.amountFormatted ?? fallbackAmount,
      sendSymbol: data.details?.currencyIn?.currency?.symbol ?? '',
      receiveAmount: data.details?.currencyOut?.amountFormatted ?? '0',
      receiveSymbol: data.details?.currencyOut?.currency?.symbol ?? 'USDC',
      totalFeeUsd,
      totalFeePercent: data.details?.totalImpact?.percent,
      timeEstimate: data.details?.timeEstimate ?? 0,
    };
  }

  @backgroundMethod()
  async getRelayQuote(params: IRelayQuoteParams): Promise<IRelayDepositInfo> {
    const currency = await this._validateQuoteRoute(params);
    const requestBody = this._buildQuoteRequest({
      ...params,
      decimals: currency.decimals,
    });
    const data = await this._fetchQuote(requestBody);
    return this._buildDepositInfo(data, params.amount);
  }

  @backgroundMethod()
  async getRelayMaxQuote(params: {
    originChainId: number;
    originCurrency: string;
    recipient: string;
    user?: string;
    refundTo?: string;
    amount?: string;
    decimals?: number;
  }): Promise<IRelayDepositInfo> {
    const quoteAmount = params.amount || '100';
    const currency = await this._validateQuoteRoute(params);

    // Parallel: quote for deposit address + fees, large probe for max amount
    const [quoteResult, probeResult] = await Promise.allSettled([
      this._fetchQuote(
        this._buildQuoteRequest({
          originChainId: params.originChainId,
          originCurrency: params.originCurrency,
          recipient: params.recipient,
          user: params.user,
          refundTo: params.refundTo,
          amount: quoteAmount,
          decimals: currency.decimals,
        }),
      ),
      this._fetchQuote(
        this._buildQuoteRequest({
          originChainId: params.originChainId,
          originCurrency: params.originCurrency,
          recipient: params.recipient,
          user: params.user,
          refundTo: params.refundTo,
          amount: MAX_EXACT_INPUT_PROBE_AMOUNT,
          useDepositAddress: false,
          decimals: currency.decimals,
        }),
      ),
    ]);

    if (quoteResult.status === 'rejected') {
      throw new OneKeyError({
        message: `Relay quote failed: ${quoteResult.reason instanceof Error ? quoteResult.reason.message : String(quoteResult.reason)}`,
      });
    }

    const depositInfo = this._buildDepositInfo(quoteResult.value, quoteAmount);

    // Extract max amount from probe result
    let maxReceiveAmount: string | undefined;
    if (probeResult.status === 'fulfilled') {
      maxReceiveAmount =
        probeResult.value.details?.currencyOut?.amountFormatted;
    } else {
      const errorMessage =
        probeResult.reason instanceof Error
          ? probeResult.reason.message
          : String(probeResult.reason);
      maxReceiveAmount =
        this._parseMaxAmountFromError(errorMessage) ?? undefined;
    }

    return {
      ...depositInfo,
      maxReceiveAmount,
    };
  }
}

export default ServiceRelay;
