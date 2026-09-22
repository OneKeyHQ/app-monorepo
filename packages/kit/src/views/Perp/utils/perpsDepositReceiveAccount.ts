import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

export interface IPerpsDepositReceiveAccountDeps {
  getGlobalDeriveTypeOfNetwork: (params: {
    networkId: string;
  }) => Promise<IAccountDeriveTypes | undefined>;
  getNetworkAccount: (params: {
    accountId: string | undefined;
    indexedAccountId: string | undefined;
    networkId: string;
    deriveType: IAccountDeriveTypes;
  }) => Promise<INetworkAccount>;
}

// The Perps active account is always the EVM (Arbitrum) account, but the
// deposit token list spans other chains (e.g. Solana). The receive page
// resolves its address from the accountId it is given, so a cross-chain
// token must be paired with the account of its own network under the same
// indexed account — otherwise the EVM account id fails the impl check and
// the page renders without a QR code (OK-62522).
export async function resolvePerpsDepositReceiveAccountId({
  selectedAccountId,
  indexedAccountId,
  tokenNetworkId,
  deps,
}: {
  selectedAccountId: string | null | undefined;
  indexedAccountId: string | null | undefined;
  tokenNetworkId: string;
  deps: IPerpsDepositReceiveAccountDeps;
}): Promise<string> {
  const fallbackAccountId = selectedAccountId ?? '';
  // Imported / watching accounts have no indexed account, so there is no
  // sibling account on another chain to switch to.
  if (!indexedAccountId || !tokenNetworkId) {
    return fallbackAccountId;
  }
  try {
    const deriveType =
      (await deps.getGlobalDeriveTypeOfNetwork({
        networkId: tokenNetworkId,
      })) ?? 'default';
    const networkAccount = await deps.getNetworkAccount({
      accountId: undefined,
      indexedAccountId,
      networkId: tokenNetworkId,
      deriveType,
    });
    return networkAccount.id;
  } catch {
    // No account for that network yet: hand over an empty accountId so the
    // receive page runs its own indexed-account lookup (which also scans the
    // other derive types) instead of failing on the mismatched EVM id.
    return '';
  }
}
