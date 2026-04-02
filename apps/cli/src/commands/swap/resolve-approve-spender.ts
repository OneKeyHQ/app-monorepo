/**
 * Resolve the ERC-20 approve spender address for a swap order.
 *
 * Priority:
 *  1. allowanceTarget from the persisted quote (orderAllowance)
 *  2. allowanceTarget from the build-tx response (buildAllowance)
 *  3. tx.to — the swap router contract (fallback)
 *
 * Most DEX aggregators use the router as the transferFrom caller,
 * so tx.to IS the spender when providers omit allowance info.
 * Returning undefined would skip the allowance check, which is unsafe.
 */
export function resolveApproveSpender(
  orderAllowanceTarget: string | undefined,
  buildAllowanceTarget: string | undefined,
  swapTxTo: string,
): string {
  if (!orderAllowanceTarget && !buildAllowanceTarget) {
    process.stderr.write(
      `[WARN] No allowanceTarget in quote/build — falling back to tx.to (${swapTxTo}). checkAllowance will verify.\n`,
    );
  }
  return orderAllowanceTarget ?? buildAllowanceTarget ?? swapTxTo;
}
