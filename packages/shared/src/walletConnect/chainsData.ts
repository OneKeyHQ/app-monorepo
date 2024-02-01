import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { IMPL_EVM } from '../engine/engineConsts';

import { EIP155_SIGNING_METHODS, getEIP155Chains } from './EIP155Data';

import type { Web3WalletTypes } from '@walletconnect/web3wallet';

export type INamespaceUnion = 'eip155';

export const WALLET_CONNECT_ALL_CHAINS = [...getEIP155Chains()];

export const getAllChains = memoizee(() => [...getEIP155Chains()], {
  maxAge: timerUtils.getTimeDurationMs({
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

const supportMethodsMap: Record<INamespaceUnion, string[]> = {
  eip155: Object.values(EIP155_SIGNING_METHODS),
};

export const checkMethodSupport = (
  namespace: INamespaceUnion,
  method: string,
) => (supportMethodsMap[namespace] ?? []).includes(method);

const networkImplMap = {
  eip155: IMPL_EVM,
};
export const getNetworkImplByNamespace = (namespace: INamespaceUnion) =>
  networkImplMap[namespace];
