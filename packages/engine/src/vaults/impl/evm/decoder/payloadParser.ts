import { ethers } from '@onekeyfe/blockchain-libs';

import { SendConfirmPayload } from '@onekeyhq/kit/src/views/Send/types';
import { SwapQuote } from '@onekeyhq/kit/src/views/Swap/typings';

import { Network } from '../../../../types/network';

import { EVMDecodedItemInternalSwap, EVMDecodedTxType } from './types';

import type { Engine } from '../../../..';

const NativeCurrencyPseudoAddress =
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const isSendConfirmPayload = (payload: any): payload is SendConfirmPayload =>
  'payloadType' in payload;

const isSwapQuote = (payload: SendConfirmPayload): payload is SwapQuote =>
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
    const { buyTokenAddress, sellTokenAddress, buyAmount, sellAmount } =
      payload;

    const tokensInfo = (
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
      const token = await engine.getOrAddToken(network.id, address);
      const symbol = token?.symbol ?? '';
      const amount = ethers.utils.formatUnits(tokenAmount, token?.decimals);
      return { amount, symbol };
    });

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
