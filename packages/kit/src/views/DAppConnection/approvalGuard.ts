// The connection modal approves the account held in React state, while the
// newest observation arrives through a ref. State can lag the ref across a
// render, and approval spans several awaits (bot-wallet lookup, warning
// dialog), so the two are re-compared before anything is written.
export function isApprovalAccountSuperseded({
  approvingAccountId,
  approvingObservationRevision,
  latestAccountId,
  latestObservationRevision,
}: {
  approvingAccountId: string | undefined;
  approvingObservationRevision: number;
  latestAccountId: string | undefined;
  latestObservationRevision: number;
}): boolean {
  if (!approvingAccountId) {
    return false;
  }
  return (
    latestObservationRevision !== approvingObservationRevision ||
    latestAccountId !== approvingAccountId
  );
}
