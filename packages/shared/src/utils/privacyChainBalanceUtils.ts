import BigNumber from 'bignumber.js';

import type { IBalanceStatus } from '../../types/token';

// Balance composition for privacy chains, mirroring the history split in
// privacyChainHistoryUtils: the account has a PUBLIC half an indexer can see
// and a PRIVATE half only the local scan can see.
//
// Two rules that are easy to get wrong, and expensive when they are:
//
// 1. A total balance from an indexer does not establish availability. The host
//    supplies availability from the private note policy and validated public
//    UTXOs. This account display aggregate must not feed a selected-pool Max.
//
// 2. When the indexer is unavailable, fall back to the local scan's view of
//    the public half rather than dropping it. Showing a smaller balance
//    because a third party had a bad minute reads as "my money disappeared".

export type IPrivacyChainComposedBalance = {
  // zatoshi strings
  total: string;
  spendable: string;
  frozen: string;
  publicSideSource: 'indexer' | 'local';
  balanceStatus?: IBalanceStatus;
};

export function composePrivacyChainBalance({
  privateSide,
  publicSideLocal,
  publicSideIndexer,
  spendable,
  privateSideComplete = true,
}: {
  // Shielded/private pools, from the local scan. No other source exists.
  privateSide: string | undefined;
  privateSideComplete?: boolean;
  // The public half as the local scan sees it -- the fallback, and what we
  // showed before an indexer was wired in at all.
  publicSideLocal: string | undefined;
  // The public half from the indexer. Undefined means it could not be asked,
  // NOT that the balance is zero.
  publicSideIndexer: string | undefined;
  // Account display availability, including each independently spendable pool.
  spendable: string | undefined;
}): IPrivacyChainComposedBalance {
  const usingIndexer = new BigNumber(publicSideIndexer ?? '').isFinite();
  const publicSide = new BigNumber(
    (usingIndexer ? publicSideIndexer : publicSideLocal) ?? '',
  );
  const privateValue = new BigNumber(privateSide ?? '');
  const hasTotal =
    privateSideComplete && privateValue.isFinite() && publicSide.isFinite();
  const observedTotal = privateValue.plus(publicSide);
  const spendableValue = BigNumber.max(new BigNumber(spendable ?? ''), 0);
  // Independently fetched totals can lag a newer validated spendable snapshot.
  const total = BigNumber.max(
    observedTotal,
    spendableValue.isFinite() ? spendableValue : 0,
  );
  // Independently spendable public funds are not frozen merely because the
  // private scanner has not seen them.
  const frozen = BigNumber.max(total.minus(spendableValue), 0);
  const incompleteStatus =
    privateValue.isFinite() || publicSide.isFinite()
      ? 'partial'
      : 'unavailable';
  return {
    total: hasTotal ? total.toFixed() : '',
    spendable: spendableValue.isFinite() ? spendableValue.toFixed() : '',
    frozen: hasTotal && frozen.isFinite() ? frozen.toFixed() : '',
    publicSideSource: usingIndexer ? 'indexer' : 'local',
    balanceStatus: hasTotal ? 'complete' : incompleteStatus,
  };
}
