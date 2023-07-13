import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { ManageNetworkModalRoutes } from '@onekeyhq/kit/src/views/ManageNetworks/types';
import { type ManageNetworkRoutesParams } from '@onekeyhq/kit/src/views/ManageNetworks/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { SwapQuoter } from '../Swap/quoter';

import {
  MainnetLidoContractAddress,
  TestnetLidoContractAddress,
} from './config';

import type { FetchQuoteParams } from '../Swap/typings';

const assembleTokenAddress = (params: {
  networkId?: string;
  tokenIdOnNetwork?: string;
}) => {
  const { tokenIdOnNetwork, networkId } = params;
  if (networkId) {
    return tokenIdOnNetwork
      ? `${networkId}--${tokenIdOnNetwork}`
      : `${networkId}`;
  }
  return '';
};

const tokensSupportETHStake: string[] = [
  OnekeyNetwork.eth,
  OnekeyNetwork.goerli,
];

const tokenSupportMaticStake: string[] = [];

export enum StakingTypes {
  eth = 'eth',
  matic = 'matic',
}

export const coingeckoId2StakingTypes: Record<
  string,
  StakingTypes | undefined
> = {
  ethereum: StakingTypes.eth,
};

const stakingType2NetworkIds: Record<string, string[] | undefined> = {
  [StakingTypes.eth]: [OnekeyNetwork.eth, OnekeyNetwork.goerli],
  [StakingTypes.matic]: [OnekeyNetwork.eth, OnekeyNetwork.goerli],
};

export const getStakeSelectNetworkAccountFilter: (
  stakingType: string | string,
) =>
  | ManageNetworkRoutesParams[ManageNetworkModalRoutes.AllNetworksNetworkSelector]['filter']
  | undefined = (stakingType: string) => {
  const networkIds = stakingType2NetworkIds[stakingType];
  if (!networkIds || networkIds.length === 0) {
    return undefined;
  }
  return ({ network }) => !!network && networkIds.includes(network.id);
};

export const isAccountCompatibleWithStakingTypes = (
  accountId: string,
  type: string,
) => {
  const networkIds = stakingType2NetworkIds[type];
  if (!networkIds || networkIds.length === 0) {
    return false;
  }
  return networkIds.some((networkId) =>
    isAccountCompatibleWithNetwork(accountId, networkId),
  );
};

export const isSupportStakingType = ({
  networkId,
  tokenIdOnNetwork,
}: {
  networkId?: string;
  tokenIdOnNetwork?: string;
}): StakingTypes | undefined => {
  const address = assembleTokenAddress({ networkId, tokenIdOnNetwork });
  if (tokensSupportETHStake.includes(address)) {
    return StakingTypes.eth;
  }
  if (tokenSupportMaticStake.includes(address)) {
    return StakingTypes.matic;
  }
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
