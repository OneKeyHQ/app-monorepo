import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { getTimeDurationMs } from '../../../utils/helper';

import { getEIP155Chains } from './EIP155Data';

export const WALLET_CONNECT_ALL_CHAINS = [...getEIP155Chains()];

const getAllChains = memoizee(() => [...getEIP155Chains()], {
  maxAge: getTimeDurationMs({
    minute: 5,
  }),
});

export function getChainData(chainId?: string) {
  if (!chainId) return;
  const [namespace, reference] = chainId.toString().split(':');
  const allChainsData = getAllChains();
  return allChainsData.find(
    (chain) => chain.chainId === reference && chain.namespace === namespace,
  );
}
