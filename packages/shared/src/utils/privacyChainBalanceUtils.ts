import BigNumber from 'bignumber.js';

import type { IBalanceStatus } from '../../types/token';

// Indexer total is not availability (never feeds a selected-pool Max).
// Public half has no local-scan fallback; unreachable means incomplete, not a shrunk total.

export type IPrivacyChainComposedBalance = {
  // zatoshi strings
  total: string;
  spendable: string;
  frozen: string;
  balanceStatus?: IBalanceStatus;
};

export function composePrivacyChainBalance({
  privateSide,
  publicSideIndexer,
  spendable,
  privateSideComplete = true,
}: {
  // Shielded/private pools, from the local scan. No other source exists.
  privateSide: string | undefined;
  privateSideComplete?: boolean;
  // Undefined means it could not be asked, not that the balance is zero.
  publicSideIndexer: string | undefined;
  // Account display availability, including each independently spendable pool.
  spendable: string | undefined;
}): IPrivacyChainComposedBalance {
  const publicSide = new BigNumber(publicSideIndexer ?? '');
  const privateValue = new BigNumber(privateSide ?? '');
  const knownSides = [privateValue, publicSide].filter((side) =>
    side.isFinite(),
  );
  const hasTotal =
    privateSideComplete && privateValue.isFinite() && publicSide.isFinite();
  const observedTotal = knownSides.reduce(
    (sum, side) => sum.plus(side),
    new BigNumber(0),
  );
  const spendableValue = BigNumber.max(new BigNumber(spendable ?? ''), 0);
  // Independently fetched totals can lag a newer validated spendable snapshot.
  const total = BigNumber.max(
    observedTotal,
    spendableValue.isFinite() ? spendableValue : 0,
  );
  // Independently spendable public funds aren't frozen just because the
  // private scanner hasn't seen them.
  const frozen = BigNumber.max(total.minus(spendableValue), 0);
  let balanceStatus: IPrivacyChainComposedBalance['balanceStatus'] =
    'unavailable';
  if (hasTotal) {
    balanceStatus = 'complete';
  } else if (knownSides.length > 0) {
    balanceStatus = 'partial';
  }
  return {
    // A still-backfilling or unreachable side still shows the other side's
    // figure, marked partial rather than blank.
    total: knownSides.length > 0 ? total.toFixed() : '',
    spendable: spendableValue.isFinite() ? spendableValue.toFixed() : '',
    frozen: hasTotal && frozen.isFinite() ? frozen.toFixed() : '',
    balanceStatus,
  };
}
