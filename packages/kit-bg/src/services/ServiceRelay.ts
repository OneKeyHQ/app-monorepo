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
    8_253_038, // Bitcoin
    728_126_428, // Tron
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
    8_253_038: {
      logo: 'https://uni.onekey-asset.com/static/chain/btc.png',
      displayName: 'Bitcoin',
    },
    728_126_428: {
      logo: 'https://uni.onekey-asset.com/static/chain/tron.png',
      displayName: 'Tron',
    },
  };

  // Well-known token logos (native tokens don't have logoURI from API)
  private static readonly TOKEN_LOGO_MAP: Record<string, string> = {
    eth: 'https://uni.onekey-asset.com/static/chain/eth.png',
    weth: 'https://uni.onekey-asset.com/static/chain/eth.png',
    btc: 'https://uni.onekey-asset.com/static/chain/btc.png',
    wbtc: 'https://uni.onekey-asset.com/static/chain/btc.png',
  };

  // Chains not returned by /chains API, hardcoded
  private static readonly EXTRA_CHAINS: {
    chain: IRelayChain;
    currencies: IRelayCurrency[];
  }[] = [
    {
      chain: {
        id: 8_253_038,
        name: 'Bitcoin',
        icon: 'https://uni.onekey-asset.com/static/chain/btc.png',
        vmType: 'btc',
      },
      currencies: [
        {
          chainId: 8_253_038,
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
        id: 728_126_428,
        name: 'Tron',
        icon: 'https://uni.onekey-asset.com/static/chain/tron.png',
        vmType: 'tvm',
      },
      currencies: [
        {
          chainId: 728_126_428,
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

    const response = await fetch('https://api.relay.link/chains');
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
            logoURI:
              c.logoURI ||
              ServiceRelay.TOKEN_LOGO_MAP[c.symbol.toLowerCase()] ||
              `https://uni.onekey-asset.com/server-service-indexer/evm--${chain.id}/tokens/address-${c.address}.png`,
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

  private _buildQuoteRequest(params: {
    originChainId: number;
    originCurrency: string;
    recipient: string;
    amount: string;
  }): IRelayQuoteRequest {
    const { originChainId, originCurrency, recipient, amount } = params;
    const USDC_DECIMALS = 8;
    const amountInSmallestUnit = BigInt(
      Math.floor(parseFloat(amount) * 10 ** USDC_DECIMALS),
    ).toString();

    const isNonEvm =
      originChainId === 8_253_038 || originChainId === 728_126_428;

    if (isNonEvm) {
      // BTC dummy user, Tron dummy user
      const dummyUser =
        originChainId === 8_253_038
          ? 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
          : 'TCWTKkQUNJw5rUersaecwkGKkxpU5amwmJ';
      return {
        user: dummyUser,
        originChainId,
        destinationChainId: 1337,
        originCurrency,
        destinationCurrency: '0x00000000000000000000000000000000',
        recipient,
        tradeType: 'EXPECTED_OUTPUT',
        amount: amountInSmallestUnit,
        useDepositAddress: true,
        referrer: 'onekey.so',
        topupGas: false,
        explicitDeposit: false,
      };
    }

    return {
      user: '0x0000000000000000000000000000000000000001',
      originChainId,
      destinationChainId: 1337,
      originCurrency,
      destinationCurrency: '0x00000000000000000000000000000000',
      recipient,
      tradeType: 'EXACT_OUTPUT',
      amount: amountInSmallestUnit,
      useDepositAddress: true,
      refundTo: recipient,
    };
  }

  private _parseDepositAddress(data: IRelayQuoteResponse): string {
    let depositAddress = '';
    for (const step of data.steps ?? []) {
      if (step.depositAddress) {
        depositAddress = step.depositAddress;
        break;
      }
      for (const item of step.items ?? []) {
        if (item.data?.depositAddress) {
          depositAddress = item.data.depositAddress;
          break;
        }
        if (!depositAddress && item.data?.to) {
          depositAddress = item.data.to;
        }
      }
      if (depositAddress) break;
    }
    return depositAddress;
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
    const response = await fetch('https://api.relay.link/quote/v2', {
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

  @backgroundMethod()
  async getRelayQuote(params: {
    originChainId: number;
    originCurrency: string;
    recipient: string;
    amount: string;
  }): Promise<IRelayDepositInfo> {
    const requestBody = this._buildQuoteRequest(params);
    const data = await this._fetchQuote(requestBody);

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
      sendAmount: data.details?.currencyIn?.amountFormatted ?? params.amount,
      sendSymbol: data.details?.currencyIn?.currency?.symbol ?? '',
      receiveAmount: data.details?.currencyOut?.amountFormatted ?? '0',
      receiveSymbol: data.details?.currencyOut?.currency?.symbol ?? 'USDC',
      totalFeeUsd,
      timeEstimate: data.details?.timeEstimate ?? 0,
    };
  }

  @backgroundMethod()
  async getRelayMaxQuote(params: {
    originChainId: number;
    originCurrency: string;
    recipient: string;
  }): Promise<IRelayDepositInfo> {
    const DEFAULT_AMOUNT = '100';
    const PROBE_AMOUNT = '10000000'; // 10M USD probe to find max liquidity

    // Parallel: small quote for deposit address + large probe for max amount
    const [quoteResult, probeResult] = await Promise.allSettled([
      this._fetchQuote(
        this._buildQuoteRequest({ ...params, amount: DEFAULT_AMOUNT }),
      ),
      this._fetchQuote(
        this._buildQuoteRequest({ ...params, amount: PROBE_AMOUNT }),
      ),
    ]);

    // Extract deposit info from the small quote
    if (quoteResult.status === 'rejected') {
      throw new OneKeyError({
        message: `Relay quote failed: ${quoteResult.reason instanceof Error ? quoteResult.reason.message : String(quoteResult.reason)}`,
      });
    }

    const data = quoteResult.value;
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

    // Extract max amount from probe result
    let maxReceiveAmount: string | undefined;
    if (probeResult.status === 'fulfilled') {
      // Probe succeeded — liquidity >= 10M, use probe's output amount
      maxReceiveAmount =
        probeResult.value.details?.currencyOut?.amountFormatted;
    } else {
      // Probe failed — parse max from INSUFFICIENT_LIQUIDITY error
      const errorMessage =
        probeResult.reason instanceof Error
          ? probeResult.reason.message
          : String(probeResult.reason);
      maxReceiveAmount =
        this._parseMaxAmountFromError(errorMessage) ?? undefined;
    }

    return {
      depositAddress,
      sendAmount: data.details?.currencyIn?.amountFormatted ?? DEFAULT_AMOUNT,
      sendSymbol: data.details?.currencyIn?.currency?.symbol ?? '',
      receiveAmount: data.details?.currencyOut?.amountFormatted ?? '0',
      receiveSymbol: data.details?.currencyOut?.currency?.symbol ?? 'USDC',
      totalFeeUsd,
      timeEstimate: data.details?.timeEstimate ?? 0,
      maxReceiveAmount,
    };
  }
}

export default ServiceRelay;
