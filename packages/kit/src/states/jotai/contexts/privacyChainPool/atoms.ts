import type { IBalanceStatus } from '@onekeyhq/shared/types/token';

import { createJotaiContext } from '../../utils/createJotaiContext';

// Per-Provider scope: each mounted tab gets its own store and cannot
// overwrite another tab's pool.

export type IPrivacyChainPoolActionData = {
  type: 'shield' | 'withdraw';
  fromAddress: string;
  toAddress?: string;
  amount?: string;
  // Withdraw only: settings.localWallet.pools key the inputs must come from.
  spendSource?: string;
  disabled: boolean;
  onDone: () => void;
};

export type IPrivacyChainPoolDisplayData = {
  // Readers must compare this before rendering: a stale ownerKey after an
  // account switch would show a wrong balance, not just a stale one.
  ownerKey: string;
  address?: string;
  balanceParsed?: string;
  balanceStatus?: IBalanceStatus;
  // True once a read completes (success or failure), not "balance present".
  // Failed reads render as unavailable, never as a spinner or a zero.
  balanceSettled: boolean;
  action?: IPrivacyChainPoolActionData;
};

export function privacyChainPoolOwnerKey({
  accountId,
  networkId,
  poolId,
}: {
  accountId: string;
  networkId: string;
  poolId: number | undefined;
}): string {
  return `${accountId}_${networkId}_${poolId ?? ''}`;
}

const {
  Provider: ProviderJotaiContextPrivacyChainPool,
  withProvider: withPrivacyChainPoolProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();

export {
  ProviderJotaiContextPrivacyChainPool,
  contextAtomMethod,
  withPrivacyChainPoolProvider,
};

export const {
  atom: privacyChainPoolDisplayAtom,
  use: usePrivacyChainPoolDisplayAtom,
} = contextAtom<IPrivacyChainPoolDisplayData | undefined>(undefined);
