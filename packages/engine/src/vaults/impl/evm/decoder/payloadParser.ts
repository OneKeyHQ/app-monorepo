import type { SendConfirmPayload } from '@onekeyhq/kit/src/views/Send/types';
import type { SwapQuoteTx } from '@onekeyhq/kit/src/views/Swap/typings';

import { ethers } from '../sdk/ethers';

import { EVMDecodedTxType } from './types';

import type { Engine } from '../../../..';
import type { Network } from '../../../../types/network';
import type { EVMDecodedItemInternalSwap } from './types';

const NativeCurrencyPseudoAddress =
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const WethAddressSet = new Set([
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // chainID: 1 (Mainnet-WETH)
  '0xd0a1e359811322d97991e03f863a0c30c2cf029c', // chainID: 42 (kovan-WETH)
  '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // chainID: 137 (Matic-WMATIC)
  '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7', // chainID: 43114 (Avalache C-chain-WAVAX)
  '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // chainID: 56 (BSC-WBNB)
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // chainID: 42161 (Arbitrum-WETH)
  '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83', // chainID: 250 (Fantom-WFTM)
  '0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f', // chainID: 128 (HECO-WHT)
]);

const isSendConfirmPayload = (payload: any): payload is SendConfirmPayload =>
  'payloadType' in payload;

const isSwapQuote = (payload: SendConfirmPayload): payload is SwapQuoteTx =>
  payload.payloadType === 'InternalSwap';

const parsePayload = async (
  rawPayload: any,
  network: Network,
  engine: Engine,
) => {
  if (!rawPayload) {
    return null;
  }

  let payload = rawPayload;
  if (typeof rawPayload === 'string') {
    try {
      payload = JSON.parse(rawPayload);
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  if (!isSendConfirmPayload(payload)) {
    return null;
  }

  if (isSwapQuote(payload)) {
    const { buyTokenAddress, sellTokenAddress, buyAmount, sellAmount, value } =
      payload;

    let tokensInfo;
    if (
      buyTokenAddress === sellTokenAddress &&
      WethAddressSet.has(buyTokenAddress)
    ) {
      // Wrap and Unwrap Native Currency

      const wToken = await engine.ensureTokenInDB(network.id, buyTokenAddress);
      const wSymbol = wToken?.symbol ?? '';
      const wAmount = ethers.utils.formatUnits(buyAmount, wToken?.decimals);
      const nSymbol = network.symbol;
      const nAmount = ethers.utils.formatEther(buyAmount);
      const wrapped = { symbol: wSymbol, amount: wAmount };
      const native = { symbol: nSymbol, amount: nAmount };
      tokensInfo =
        !value || value === '0' ? [native, wrapped] : [wrapped, native];
    } else {
      // Swap

      tokensInfo = (
        [
          [buyTokenAddress, buyAmount],
          [sellTokenAddress, sellAmount],
        ] as const
      ).map(async ([tokenAddress, tokenAmount]) => {
        const address = tokenAddress.toLowerCase();
        if (address === NativeCurrencyPseudoAddress) {
          const amount = ethers.utils.formatEther(tokenAmount);
          return { amount, symbol: network.symbol };
        }
        const token = await engine.ensureTokenInDB(network.id, address);
        const symbol = token?.symbol ?? '';
        const amount = ethers.utils.formatUnits(tokenAmount, token?.decimals);
        return { amount, symbol };
      });
    }

    const [buy, sell] = await Promise.all(tokensInfo);
    const info: EVMDecodedItemInternalSwap = {
      type: EVMDecodedTxType.INTERNAL_SWAP,
      buyTokenAddress,
      sellTokenAddress,
      buyTokenSymbol: buy.symbol,
      sellTokenSymbol: sell.symbol,
      buyAmount: buy.amount,
      sellAmount: sell.amount,
    };
    const interactWith = 'Onekey Swap';
    return { txType: EVMDecodedTxType.INTERNAL_SWAP, info, interactWith };
  }

  return null;
};

export { parsePayload };
