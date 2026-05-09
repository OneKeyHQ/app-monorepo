export function shouldEnableFirstNoAmountAction({
  createAddressLoading,
  disabled,
  hasAmount,
  hasClickedWithoutAmount,
  shouldCreateAddress,
}: {
  createAddressLoading: boolean;
  disabled?: boolean;
  hasAmount: boolean;
  hasClickedWithoutAmount: boolean;
  shouldCreateAddress?: boolean;
}) {
  return (
    !disabled &&
    !hasAmount &&
    !hasClickedWithoutAmount &&
    !shouldCreateAddress &&
    !createAddressLoading
  );
}

export function shouldUseHardDisabledAction({
  disabled,
  noAccount,
  shouldCreateAddress,
}: {
  disabled?: boolean;
  noAccount: boolean;
  shouldCreateAddress?: boolean;
}) {
  return Boolean(disabled && !noAccount && !shouldCreateAddress);
}
