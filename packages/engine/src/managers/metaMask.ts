import axios from 'axios';

import { SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../errors';

import type {
  MetaMaskGasAPIResponse,
  MetaMaskGasInfo,
} from '../types/metaMask';

const META_MASK_GAS_BASR_URL = 'https://gas-api.metaswap.codefi.network';

const getMetaMaskGasInfo = async (
  networkId: string,
): Promise<MetaMaskGasInfo | null> => {
  const [, chainId] = networkId.split(SEPERATOR);
  const resp = (
    await axios.get<MetaMaskGasAPIResponse>(
      `${META_MASK_GAS_BASR_URL}/networks/${chainId}/suggestedGasFees`,
    )
  ).data;

  if (resp.error) {
    throw new OneKeyInternalError('metamast bad response');
  }

  const { estimatedBaseFee, low, medium, high, networkCongestion } = resp;

  const prices = [low, medium, high].map(
    (p: {
      suggestedMaxPriorityFeePerGas: string;
      suggestedMaxFeePerGas: string;
    }) => ({
      baseFee: estimatedBaseFee,
      maxPriorityFeePerGas: p.suggestedMaxPriorityFeePerGas,
      maxFeePerGas: p.suggestedMaxFeePerGas,
    }),
  );

  return {
    baseFee: estimatedBaseFee,
    networkCongestion,
    prices,
  };
};

export { getMetaMaskGasInfo };
