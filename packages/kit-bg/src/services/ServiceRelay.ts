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
} from '@onekeyhq/shared/types/relay';

import ServiceBase from './ServiceBase';

// --- Relay protocol constants ---
const RELAY_API_BASE = 'https://api.relay.link';
const HYPERLIQUID_CHAIN_ID = 1337;
const HYPERLIQUID_DESTINATION_CURRENCY =
  '0x00000000000000000000000000000000';
// Hyperliquid uses 8-decimal USDC for EXACT_OUTPUT amount encoding
const DESTINATION_DECIMALS = 8;
const DEFAULT_EVM_DECIMALS = 18;
const MAX_PROBE_AMOUNT = '10000000'; // 10M USD probe to find max liquidity

// Non-EVM chain IDs
const BITCOIN_CHAIN_ID = 8_253_038;
const TRON_CHAIN_ID = 728_126_428;

// Dummy users for non-EVM quote requests (API requires a valid address format)
const NON_EVM_DUMMY_USERS: Record<number, string> = {
  [BITCOIN_CHAIN_ID]: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  [TRON_CHAIN_ID]: 'TCWTKkQUNJw5rUersaecwkGKkxpU5amwmJ',
};
const EVM_DUMMY_USER = '0x0000000000000000000000000000000000000001';

@backgroundClass()
class ServiceRelay extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // Major chains supported for Relay deposit
  private static readonly SUPPORTED_CHAIN_IDS = new Set([
    1, // Ethereum
    10, // Optimism
    56, // BNB Chain
    137, // Polygon
    8453, // Base
    42_161, // Arbitrum
    43_114, // Avalanche
    BITCOIN_CHAIN_ID,
    TRON_CHAIN_ID,
  ]);

  // Major currencies to keep (by symbol, case-insensitive)
  private static readonly SUPPORTED_CURRENCY_SYMBOLS = new Set([
    'usdc',
    'usdt',
    'eth',
    'weth',
    'btc',
    'wbtc',
  ]);

  // Chain display info overrides
  private static readonly CHAIN_INFO_MAP: Record<
    number,
    { logo: string; displayName: string }
  > = {
    1: {
      logo: 'https://uni.onekey-asset.com/static/chain/eth.png',
      displayName: 'Ethereum',
    },
    10: {
      logo: 'https://uni.onekey-asset.com/static/chain/optimism.png',
      displayName: 'Optimism',
    },
    56: {
      logo: 'https://uni.onekey-asset.com/static/chain/bsc.png',
      displayName: 'BNB Chain',
    },
    137: {
      logo: 'https://uni.onekey-asset.com/static/chain/polygon.png',
      displayName: 'Polygon',
    },
    8453: {
      logo: 'https://uni.onekey-asset.com/static/chain/base.png',
      displayName: 'Base',
    },
    42_161: {
      logo: 'https://uni.onekey-asset.com/static/chain/arbitrum.png',
      displayName: 'Arbitrum',
    },
    43_114: {
      logo: 'https://uni.onekey-asset.com/static/chain/avalanche.png',
      displayName: 'Avalanche',
    },
    [BITCOIN_CHAIN_ID]: {
      logo: 'https://uni.onekey-asset.com/static/chain/btc.png',
      displayName: 'Bitcoin',
    },
    [TRON_CHAIN_ID]: {
      logo: 'https://uni.onekey-asset.com/static/chain/tron.png',
      displayName: 'Tron',
    },
  };

  // Well-known token logos — takes priority over API-provided logoURI
  private static readonly TOKEN_LOGO_MAP: Record<string, string> = {
    eth: 'https://uni.onekey-asset.com/static/chain/eth.png',
    weth: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png',
    btc: 'https://uni.onekey-asset.com/static/chain/btc.png',
    wbtc: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0x2260fac5e5542a773aa44fbcfedf7c193bc2c599.png',
    usdt: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xdac17f958d2ee523a2206206994597c13d831ec7.png',
    usdc: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
  };

  // Chains not returned by /chains API, hardcoded
  private static readonly EXTRA_CHAINS: {
    chain: IRelayChain;
    currencies: IRelayCurrency[];
  }[] = [
    {
      chain: {
        id: BITCOIN_CHAIN_ID,
        name: 'Bitcoin',
        icon: 'https://uni.onekey-asset.com/static/chain/btc.png',
        vmType: 'btc',
      },
      currencies: [
        {
          chainId: BITCOIN_CHAIN_ID,
          address: 'bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqmql8k8',
          symbol: 'BTC',
          name: 'Bitcoin',
          decimals: 8,
          logoURI: 'https://uni.onekey-asset.com/static/chain/btc.png',
        },
      ],
    },
    {
      chain: {
        id: TRON_CHAIN_ID,
        name: 'Tron',
        icon: 'https://uni.onekey-asset.com/static/chain/tron.png',
        vmType: 'tvm',
      },
      currencies: [
        {
          chainId: TRON_CHAIN_ID,
          address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          symbol: 'USDT',
          name: 'Tether USD',
          decimals: 6,
          logoURI:
            'https://uni.onekey-asset.com/server-service-indexer/tron--0x2b6653dc/tokens/address-TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t.png',
        },
      ],
    },
  ];

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
          const chainInfo = ServiceRelay.CHAIN_INFO_MAP[chain.id];
          chains.push({
            id: chain.id,
            name: chainInfo?.displayName || chain.name,
            icon: chainInfo?.logo || chain.icon || '',
            vmType: chain.vmType,
          });
          currencies[chain.id] = filteredCurrencies.map((c) => ({
            chainId: c.chainId,
            address: c.address,
            symbol: c.symbol,
            name: c.name,
            decimals: c.decimals,
            logoURI: ServiceRelay._resolveTokenLogo(
              c.symbol,
              c.logoURI,
              chain.id,
              c.address,
            ),
          }));
        }
      }
    }

    // Add chains not returned by /chains API (BTC, Tron, etc.)
    for (const extra of ServiceRelay.EXTRA_CHAINS) {
      chains.push(extra.chain);
      currencies[extra.chain.id] = extra.currencies;
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

  /**
   * Convert a human-readable amount string to smallest-unit integer string.
   * Uses string splitting instead of floating-point to avoid precision loss.
   */
  private static _toSmallestUnit(amount: string, decimals: number): string {
    const [intPart, decPart = ''] = amount.split('.');
    const paddedDec = decPart.slice(0, decimals).padEnd(decimals, '0');
    const raw = `${intPart}${paddedDec}`.replace(/^0+/, '') || '0';
    return raw;
  }

  private _buildQuoteRequest(params: {
    originChainId: number;
    originCurrency: string;
    recipient: string;
    amount: string;
    tradeType?: 'EXACT_INPUT' | 'EXACT_OUTPUT';
    decimals?: number;
  }): IRelayQuoteRequest {
    const { originChainId, originCurrency, recipient, amount } = params;
    const amountDecimals =
      params.tradeType === 'EXACT_INPUT'
        ? (params.decimals ?? DEFAULT_EVM_DECIMALS)
        : DESTINATION_DECIMALS;
    const amountInSmallestUnit = ServiceRelay._toSmallestUnit(
      amount,
      amountDecimals,
    );

    const dummyUser = NON_EVM_DUMMY_USERS[originChainId];
    const isNonEvm = !!dummyUser;

    const baseRequest = {
      originChainId,
      destinationChainId: HYPERLIQUID_CHAIN_ID,
      originCurrency,
      destinationCurrency: HYPERLIQUID_DESTINATION_CURRENCY,
      recipient,
      amount: amountInSmallestUnit,
      useDepositAddress: true,
    };

    if (isNonEvm) {
      return {
        ...baseRequest,
        user: dummyUser,
        tradeType:
          params.tradeType === 'EXACT_INPUT'
            ? 'EXACT_INPUT'
            : 'EXPECTED_OUTPUT',
      };
    }

    return {
      ...baseRequest,
      user: EVM_DUMMY_USER,
      tradeType: params.tradeType || 'EXACT_OUTPUT',
      refundTo: recipient,
    };
  }

  private _parseDepositAddress(data: IRelayQuoteResponse): string {
    for (const step of data.steps ?? []) {
      if (step.depositAddress) {
        return step.depositAddress;
      }
      let fallback = '';
      for (const item of step.items ?? []) {
        if (item.data?.depositAddress) {
          return item.data.depositAddress;
        }
        if (!fallback && item.data?.to) {
          fallback = item.data.to;
        }
      }
      if (fallback) return fallback;
    }
    return '';
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
    const depositAddress = this._parseDepositAddress(data);
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
      sendAmount:
        data.details?.currencyIn?.amountFormatted ?? fallbackAmount,
      sendSymbol: data.details?.currencyIn?.currency?.symbol ?? '',
      receiveAmount: data.details?.currencyOut?.amountFormatted ?? '0',
      receiveSymbol: data.details?.currencyOut?.currency?.symbol ?? 'USDC',
      totalFeeUsd,
      totalFeePercent: data.details?.totalImpact?.percent,
      timeEstimate: data.details?.timeEstimate ?? 0,
    };
  }

  @backgroundMethod()
  async getRelayQuote(params: {
    originChainId: number;
    originCurrency: string;
    recipient: string;
    amount: string;
  }): Promise<IRelayDepositInfo> {
    const requestBody = this._buildQuoteRequest(params);
    const data = await this._fetchQuote(requestBody);
    return this._buildDepositInfo(data, params.amount);
  }

  @backgroundMethod()
  async getRelayMaxQuote(params: {
    originChainId: number;
    originCurrency: string;
    recipient: string;
    amount?: string;
    tradeType?: 'EXACT_INPUT' | 'EXACT_OUTPUT';
    decimals?: number;
  }): Promise<IRelayDepositInfo> {
    const quoteAmount = params.amount || '100';

    // Parallel: quote for deposit address + fees, large probe for max amount
    const [quoteResult, probeResult] = await Promise.allSettled([
      this._fetchQuote(
        this._buildQuoteRequest({
          originChainId: params.originChainId,
          originCurrency: params.originCurrency,
          recipient: params.recipient,
          amount: quoteAmount,
          tradeType: params.tradeType,
          decimals: params.decimals,
        }),
      ),
      this._fetchQuote(
        this._buildQuoteRequest({
          originChainId: params.originChainId,
          originCurrency: params.originCurrency,
          recipient: params.recipient,
          amount: MAX_PROBE_AMOUNT,
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
