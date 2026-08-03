import type { IHomeRuntimeOwnerScope } from '../types/homeRuntime';

const HOME_SCOPE_KEY_NAMESPACE = 'home-owner';

function encodeIdentityPart(value: string): string {
  return `${value.length}:${value}`;
}

export function buildHomeRuntimeOwnerScopeKey(
  owner: IHomeRuntimeOwnerScope,
): string {
  const networkIdentity =
    owner.network.kind === 'allNetworks'
      ? 'all'
      : `single:${encodeIdentityPart(owner.network.networkId)}`;
  return [
    HOME_SCOPE_KEY_NAMESPACE,
    encodeIdentityPart(owner.walletId),
    encodeIdentityPart(owner.accountId),
    networkIdentity,
  ].join('|');
}
