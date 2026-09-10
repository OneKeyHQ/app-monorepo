import BigNumber from 'bignumber.js';

// Balance composition for privacy chains, mirroring the history split in
// privacyChainHistoryUtils: the account has a PUBLIC half an indexer can see
// and a PRIVATE half only the local scan can see.
//
// Two rules that are easy to get wrong, and expensive when they are:
//
// 1. The indexer owns the public half's VALUE, but never the SPENDABLE
//    figure. What can be spent depends on this build's confirmation policy,
//    which pools it will draw on, and which notes are already reserved by an
//    in-flight send -- all of which live with the local wallet that builds the
//    transaction. An indexer that says "you have X" is not a promise that a
//    proposal will accept X, and wiring it to the max button is how you get a
//    send that the signer then refuses.
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
};

export function composePrivacyChainBalance({
  privateSide,
  publicSideLocal,
  publicSideIndexer,
  spendable,
}: {
  // Shielded/private pools, from the local scan. No other source exists.
  privateSide: string;
  // The public half as the local scan sees it -- the fallback, and what we
  // showed before an indexer was wired in at all.
  publicSideLocal: string;
  // The public half from the indexer. Undefined means it could not be asked,
  // NOT that the balance is zero.
  publicSideIndexer: string | undefined;
  // Local, authoritative, produced next to the code that decides what a
  // proposal will accept.
  spendable: string;
}): IPrivacyChainComposedBalance {
  const usingIndexer = publicSideIndexer !== undefined;
  const publicSide = new BigNumber(
    usingIndexer ? publicSideIndexer : publicSideLocal,
  );
  const total = new BigNumber(privateSide).plus(
    publicSide.isFinite() ? publicSide : 0,
  );
  const spendableValue = BigNumber.max(new BigNumber(spendable), 0);
  // Frozen is whatever is not spendable, by definition. When the indexer runs
  // ahead of the scan this is where the difference surfaces -- as "not
  // spendable yet", which is exactly what it is.
  const frozen = BigNumber.max(total.minus(spendableValue), 0);
  return {
    total: total.toFixed(),
    spendable: spendableValue.toFixed(),
    frozen: frozen.toFixed(),
    publicSideSource: usingIndexer ? 'indexer' : 'local',
  };
}
