import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

/**
 * Resolves the derive type for every Stock-owned account lookup.
 *
 * The selected derive type is scoped to the Stock network. Other networks use
 * their network default so a cross-network payment token cannot accidentally
 * inherit the Stock selector's derive type.
 */
export function resolveSwapStockDeriveType({
  activeDeriveType,
  networkDefaultDeriveType,
  networkId,
  selectedAccountDeriveType,
  selectedDeriveType,
  stockNetworkId,
}: {
  activeDeriveType?: IAccountDeriveTypes;
  networkDefaultDeriveType?: IAccountDeriveTypes;
  networkId: string;
  selectedAccountDeriveType?: IAccountDeriveTypes;
  selectedDeriveType?: IAccountDeriveTypes;
  stockNetworkId?: string;
}): IAccountDeriveTypes {
  if (!stockNetworkId || networkId !== stockNetworkId) {
    return networkDefaultDeriveType ?? 'default';
  }

  return (
    selectedDeriveType ??
    selectedAccountDeriveType ??
    networkDefaultDeriveType ??
    activeDeriveType ??
    'default'
  );
}

export function buildSwapStockAccountScopeKey({
  accountId,
  deriveType,
  indexedAccountId,
  networkId,
}: {
  accountId?: string;
  deriveType?: IAccountDeriveTypes;
  indexedAccountId?: string;
  networkId: string;
}) {
  return `${indexedAccountId ?? ''}:${accountId ?? ''}:${networkId}:${
    deriveType ?? 'default'
  }`;
}
