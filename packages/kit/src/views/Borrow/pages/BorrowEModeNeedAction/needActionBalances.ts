/* cspell:ignore EMODE */
import BigNumber from 'bignumber.js';

import type { IEModeStep } from './needActionSteps';

// Which wallet balance funds this repay step: the reserve address lowercased,
// including the empty-string native-token sentinel used by Aave on Ethereum.
// Returns null only for non-repay steps or an absent reserveAddress.
export function balanceLookupAddress({
  step,
}: {
  step: IEModeStep;
}): string | null {
  if (step.kind !== 'repay' || step.reserveAddress === undefined) {
    return null;
  }
  return step.reserveAddress.toLowerCase();
}

// Wallet shortfall vs the step's repay amount, rounded UP so a user topping
// up the displayed number is never left short by display truncation. Null
// when covered, unknown, or not applicable — unknown must never warn.
// ponytail: native steps ignore the gas sliver on top of the amount; the
// estimate-fee Retry path backstops it — add a gas reserve if QA hits it.
export function repayShortfall({
  step,
  balanceParsed,
}: {
  step: IEModeStep;
  balanceParsed?: string;
}): string | null {
  if (step.kind !== 'repay' || !step.amountValue) {
    return null;
  }
  if (balanceParsed === undefined) {
    return null;
  }
  const amount = new BigNumber(step.amountValue);
  const balance = new BigNumber(balanceParsed);
  if (amount.isNaN() || balance.isNaN() || balance.gte(amount)) {
    return null;
  }
  return amount.minus(balance).decimalPlaces(6, BigNumber.ROUND_UP).toFixed();
}

// Wallet balance for display: trimmed to 6dp rounding DOWN so the shown
// number never overstates what the wallet holds. Null when unknown or
// non-numeric — callers render nothing rather than a fake zero.
export function formatBalanceDisplay(balanceParsed?: string): string | null {
  if (balanceParsed === undefined) {
    return null;
  }
  const balance = new BigNumber(balanceParsed);
  if (balance.isNaN()) {
    return null;
  }
  return balance.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed();
}
