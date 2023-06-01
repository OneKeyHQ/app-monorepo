import type { Account } from '@onekeyhq/engine/src/types/account';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { SwapQuoter } from '../Swap/quoter';

import {
  MainnetLidoContractAddress,
  TestnetLidoContractAddress,
} from './config';

import type { FetchQuoteParams } from '../Swap/typings';

export const isSupportStakedAssets = (
  networkId?: string,
  tokenIdOnNetwork?: string,
): boolean => {
  const networkIds = [OnekeyNetwork.eth, OnekeyNetwork.goerli] as string[];
  const result =
    networkId && networkIds.includes(networkId) && !tokenIdOnNetwork;
  return Boolean(result);
};

export const getLidoTokenEvmAddress = (
  networkId?: string,
  tokenIdOnNetwork?: string,
): string | undefined => {
  if (!networkId) {
    return undefined;
  }
  if (networkId === OnekeyNetwork.goerli && !tokenIdOnNetwork) {
    return TestnetLidoContractAddress;
  }
  if (networkId === OnekeyNetwork.eth && !tokenIdOnNetwork) {
    return MainnetLidoContractAddress;
  }
  return undefined;
};

export const isSTETH = (networkId?: string, tokenIdOnNetwork?: string) => {
  if (networkId && tokenIdOnNetwork) {
    return (
      (networkId === OnekeyNetwork.goerli &&
        tokenIdOnNetwork.toLowerCase() ===
          TestnetLidoContractAddress.toLowerCase()) ||
      (networkId === OnekeyNetwork.eth &&
        tokenIdOnNetwork.toLowerCase() ===
          MainnetLidoContractAddress.toLowerCase())
    );
  }
  return false;
};

export async function fetchStEthRate(params: {
  networkId: string;
  account: Account;
  amount?: string;
}) {
  const { networkId, account, amount } = params;
  const typedValue = amount || '0.1';
  const nativeToken = await backgroundApiProxy.engine.getNativeTokenInfo(
    networkId,
  );
  const stETH = await backgroundApiProxy.serviceStaking.getStEthToken({
    networkId,
  });
  const network = await backgroundApiProxy.engine.getNetwork(networkId);
  const quoteParams: FetchQuoteParams = {
    networkOut: network,
    networkIn: network,
    tokenOut: nativeToken,
    tokenIn: stETH,
    slippagePercentage: '1',
    typedValue,
    independentField: 'INPUT',
    activeAccount: account,
    receivingAddress: account.address,
  };
  const res = await SwapQuoter.client.fetchQuote(quoteParams);
  return res;
}

export async function buildWithdrawStEthTransaction(input: {
  typedValue: string;
  networkId: string;
  account: Account;
}) {
  const { networkId, account, typedValue } = input;
  const nativeToken = await backgroundApiProxy.engine.getNativeTokenInfo(
    networkId,
  );
  const stETH = await backgroundApiProxy.serviceStaking.getStEthToken({
    networkId,
  });
  const network = await backgroundApiProxy.engine.getNetwork(networkId);
  const params: FetchQuoteParams = {
    networkOut: network,
    networkIn: network,
    tokenOut: nativeToken,
    tokenIn: stETH,
    slippagePercentage: '1',
    typedValue,
    independentField: 'INPUT',
    activeAccount: account,
    receivingAddress: account.address,
  };
  const res = await SwapQuoter.client.fetchQuote(params);
  const quote = res?.data;
  if (!quote) {
    throw new Error('failed to build unstake params');
  }
  return { params, quote };
}
