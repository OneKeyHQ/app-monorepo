/* cspell:ignore EMODE */
import BigNumber from 'bignumber.js';

import { countLeadingZeroDecimals } from '@onekeyhq/shared/src/utils/numberUtils';

import { type IEModeStep, shouldRepayAllForEModeStep } from './needActionSteps';

const DEFAULT_TOKEN_DECIMALS = 6;
const MAX_TOKEN_DECIMALS = 255;

function repayFundingRequirement(step: IEModeStep): BigNumber | null {
  if (step.kind !== 'repay' || !step.amountValue) {
    return null;
  }
  const amount = new BigNumber(step.amountValue);
  if (!amount.isFinite() || amount.lte(0)) {
    return null;
  }
  if (!shouldRepayAllForEModeStep(step)) {
    return amount;
  }

  const decimals =
    Number.isInteger(step.decimals) &&
    (step.decimals ?? -1) >= 0 &&
    (step.decimals ?? MAX_TOKEN_DECIMALS + 1) <= MAX_TOKEN_DECIMALS
      ? (step.decimals ?? DEFAULT_TOKEN_DECIMALS)
      : DEFAULT_TOKEN_DECIMALS;
  return amount.plus(new BigNumber(10).pow(-decimals));
}

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

// Wallet shortfall vs the step's funding requirement, rounded UP so a user
// topping up the displayed number is never left short by display truncation.
// Full-close requires one token atomic unit above the debt snapshot: equality
// cannot fund interest that accrues between the check and on-chain execution.
// Null when covered, unknown, or not applicable — unknown must never warn.
// ponytail: native steps ignore the gas sliver on top of the amount; the
// estimate-fee Retry path backstops it — add a gas reserve if QA hits it.
export function repayShortfall({
  step,
  balanceParsed,
}: {
  step: IEModeStep;
  balanceParsed?: string;
}): string | null {
  if (balanceParsed === undefined) {
    return null;
  }
  const requirement = repayFundingRequirement(step);
  const balance = new BigNumber(balanceParsed);
  if (!requirement || !balance.isFinite() || balance.gte(requirement)) {
    return null;
  }
  return requirement
    .minus(balance)
    .decimalPlaces(6, BigNumber.ROUND_UP)
    .toFixed();
}

export function hasSufficientRepayFunding({
  step,
  balanceParsed,
}: {
  step: IEModeStep;
  balanceParsed?: string;
}): boolean {
  const requirement = repayFundingRequirement(step);
  const balance = new BigNumber(balanceParsed ?? '');
  return Boolean(requirement && balance.isFinite() && balance.gte(requirement));
}

// Wallet balance for display: round DOWN so the shown number never overstates
// what the wallet holds. Keep at least four meaningful digits after leading
// zeroes; a fixed six-decimal cap turns a valid dust balance (for example
// 0.00000032 WBTC) into the misleading value "0".
export function formatBalanceDisplay(balanceParsed?: string): string | null {
  if (balanceParsed === undefined) {
    return null;
  }
  const balance = new BigNumber(balanceParsed);
  if (!balance.isFinite()) {
    return null;
  }
  const leadingZeroDecimals = balance.isZero()
    ? 0
    : countLeadingZeroDecimals(balance);
  const displayDecimals = Math.min(
    MAX_TOKEN_DECIMALS,
    Math.max(DEFAULT_TOKEN_DECIMALS, leadingZeroDecimals + 4),
  );
  return balance.decimalPlaces(displayDecimals, BigNumber.ROUND_DOWN).toFixed();
}
