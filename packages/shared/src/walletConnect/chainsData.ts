import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { getTimeDurationMs } from '@onekeyhq/shared/src/utils/timerUtils';

import { getEIP155Chains } from './EIP155Data';

import type { Web3WalletTypes } from '@walletconnect/web3wallet';

export const WALLET_CONNECT_ALL_CHAINS = [...getEIP155Chains()];

export const getAllChains = memoizee(() => [...getEIP155Chains()], {
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

export function getNotSupportedChains(
  proposal: Web3WalletTypes.SessionProposal,
): string[] {
  // Find the supported chains must
  const required = []; // [eip155:5]
  for (const [key, values] of Object.entries(
    proposal.params.requiredNamespaces,
  )) {
    const chainId = key.includes(':') ? key : values.chains ?? [];
    required.push(chainId);
  }

  return required.flat().filter((chainId) => !getChainData(chainId));
}
