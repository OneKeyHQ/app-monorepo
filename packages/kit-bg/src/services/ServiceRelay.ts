import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
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
        chain.solverCurrencies &&
        chain.solverCurrencies.length > 0
      ) {
        chains.push({
          id: chain.id,
          name: chain.name,
          icon: chain.icon,
          vmType: chain.vmType,
        });
        currencies[chain.id] = chain.solverCurrencies.map((c) => ({
          chainId: c.chainId,
          address: c.address,
          symbol: c.symbol,
          name: c.name,
          decimals: c.decimals,
          logoURI: c.logoURI,
        }));
      }
    }

    this._chainsCache = { chains, currencies };
    return this._chainsCache;
  }

  @backgroundMethod()
  async getRelayQuote(params: {
    originChainId: number;
    originCurrency: string;
    recipient: string;
    amount: string;
  }): Promise<IRelayDepositInfo> {
    const { originChainId, originCurrency, recipient, amount } = params;

    // EXACT_OUTPUT: amount is the desired USDC receive amount on Hyperliquid
    // Hyperliquid USDC (Perps) has 8 decimals per Relay API
    const USDC_DECIMALS = 8;
    const amountInSmallestUnit = BigInt(
      Math.floor(parseFloat(amount) * 10 ** USDC_DECIMALS),
    ).toString();

    const requestBody: IRelayQuoteRequest = {
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

    const response = await fetch('https://api.relay.link/quote/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Relay quote failed: ${errorText}`);
    }

    const data = (await response.json()) as IRelayQuoteResponse;

    // depositAddress can be at step level or inside items[].data
    let depositAddress = '';
    for (const step of data.steps ?? []) {
      // Step-level depositAddress (primary location per Relay API)
      if (step.depositAddress) {
        depositAddress = step.depositAddress;
        break;
      }
      // Fallback: check inside items[].data
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

    if (!depositAddress) {
      console.error(
        '[ServiceRelay] No deposit address found, response:',
        JSON.stringify(data.steps?.map((s) => ({
          id: s.id,
          depositAddress: s.depositAddress,
          items: s.items?.map((i) => ({ status: i.status, dataTo: i.data?.to, dataDepositAddress: i.data?.depositAddress })),
        }))),
      );
      throw new Error('No deposit address found in relay quote response');
    }

    const totalFeeUsd = (
      parseFloat(data.fees?.gas?.amountUsd ?? '0') +
      parseFloat(data.fees?.relayer?.amountUsd ?? '0')
    ).toFixed(2);

    return {
      depositAddress,
      sendAmount: data.details?.currencyIn?.amountFormatted ?? amount,
      sendSymbol: data.details?.currencyIn?.currency?.symbol ?? '',
      receiveAmount: data.details?.currencyOut?.amountFormatted ?? '0',
      receiveSymbol: data.details?.currencyOut?.currency?.symbol ?? 'USDC',
      totalFeeUsd,
      timeEstimate: data.details?.timeEstimate ?? 0,
    };
  }
}

export default ServiceRelay;
