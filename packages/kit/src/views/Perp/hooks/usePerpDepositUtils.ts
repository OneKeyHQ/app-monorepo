export function shouldWaitForPerpsDepositQuoteAccount({
  hasValidDepositQuoteInput,
  isDepositQuoteAccountLoading,
}: {
  hasValidDepositQuoteInput: boolean;
  isDepositQuoteAccountLoading: boolean | undefined;
}) {
  return hasValidDepositQuoteInput && isDepositQuoteAccountLoading === true;
}
