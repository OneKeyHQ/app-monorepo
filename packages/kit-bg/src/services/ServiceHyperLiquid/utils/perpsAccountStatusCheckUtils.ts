import BigNumber from 'bignumber.js';

import type { IPerpsActiveAccountStatusDetails } from '../../../states/jotai/atoms/perps';

export function buildPerpsAccountStatusCheckInitialDetails(): IPerpsActiveAccountStatusDetails {
  return {
    // undefined = activation unknown; a thrown userRole check must not be
    // persisted as confirmed-not-activated, which zeroes funded accounts
    activatedOk: undefined,
    agentOk: false,
    referralCodeOk: false,
    builderFeeOk: false,
    internalRebateBoundOk: false,
    abstractionOk: false,
  };
}

export function canApplyPerpsNotActivatedZeroState({
  checkSeq,
  latestCheckSeq,
  checkedAddress,
  activeAddress,
}: {
  checkSeq: number;
  latestCheckSeq: number;
  checkedAddress: string;
  activeAddress: string | null | undefined;
}): boolean {
  // A check that resolved before activation may return 'missing' after a newer
  // check already confirmed activation; only the latest check may write zeros
  if (checkSeq !== latestCheckSeq) {
    return false;
  }
  return activeAddress?.toLowerCase() === checkedAddress.toLowerCase();
}

export function hasPositivePerpsBalance(
  values: Array<string | null | undefined>,
): boolean {
  return values.some((value) => new BigNumber(value ?? 0).gt(0));
}

export function shouldRefreshPerpsActivationFromFundedState({
  activeAddress,
  eventAddress,
  activatedOk,
  hasFundedBalance,
  refreshHandled,
}: {
  activeAddress: string | null | undefined;
  eventAddress: string | null | undefined;
  activatedOk: boolean | undefined;
  hasFundedBalance: boolean;
  refreshHandled: boolean;
}): boolean {
  return Boolean(
    activeAddress &&
    eventAddress &&
    activeAddress.toLowerCase() === eventAddress.toLowerCase() &&
    activatedOk === false &&
    hasFundedBalance &&
    !refreshHandled,
  );
}
