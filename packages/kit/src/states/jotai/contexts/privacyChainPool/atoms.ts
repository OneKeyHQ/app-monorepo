import { createJotaiContext } from '../../utils/createJotaiContext';

// What one selected balance pool contributes to the page built around it.
//
// The pool block computes this -- it owns the balance and account-meta reads.
// The page header renders it -- it owns the balance hero, the address block
// and the action row. They are child and parent, so this used to travel
// upwards through a callback prop, with a hand-written field-by-field
// comparison in the parent to stop the churn. Adding a field to the shape and
// forgetting the comparison left the header on stale data with nothing
// failing: no type error, no test, just an old number on screen.
//
// The store is per-Provider, so the token details page's two mounted tabs get
// one scope each and cannot overwrite each other's pool.
//
// Pool identity stays a plain number here on purpose: it is the upstream
// wallet DB's pool ID. Nothing in this layer should learn the names.

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
  // Which account/network/pool these numbers describe. Readers compare it
  // before rendering: an account switch leaves the previous values in the
  // store until the next read lands, and showing those against the new
  // account is a WRONG balance, not merely a stale one.
  ownerKey: string;
  address?: string;
  balanceParsed?: string;
  // A read has come back, successfully or not -- NOT "a balance is present".
  // A failed read is settled too, and renders as unavailable rather than as a
  // spinner that never stops or, worse, a zero.
  balanceSettled: boolean;
  action?: IPrivacyChainPoolActionData;
};

// One definition for both sides. A writer and a reader that each build this
// string themselves is the failure the ownerKey exists to prevent.
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
