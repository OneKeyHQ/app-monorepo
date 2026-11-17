import BigNumber from 'bignumber.js';

import type {
  IBorrowEModeBlockerAsset,
  IBorrowEModeSwitchCheck,
} from '@onekeyhq/shared/types/staking';

import { buildNeedActionItems } from '../BorrowEModeSwitch/emodeUtils';

import {
  type IEModeStep,
  blockerSteps,
  shouldRepayAllForEModeStep,
} from './needActionSteps';

export interface IEModeApprovalRepayContext {
  step: IEModeStep;
  asset: IBorrowEModeBlockerAsset;
}

function isSameReserveAddress(
  first: string | undefined,
  second: string | undefined,
): boolean {
  return (
    first !== undefined &&
    second !== undefined &&
    first.toLowerCase() === second.toLowerCase()
  );
}

function findRepayBlockerAsset({
  check,
  step,
}: {
  check: IBorrowEModeSwitchCheck | null | undefined;
  step: IEModeStep | null | undefined;
}): IBorrowEModeBlockerAsset | undefined {
  if (step?.kind !== 'repay') {
    return undefined;
  }
  return (
    check?.repayAssets?.find((asset) =>
      isSameReserveAddress(asset.reserveAddress, step.reserveAddress),
    ) ??
    check?.additionalRepayAssets?.find((asset) =>
      isSameReserveAddress(asset.reserveAddress, step.reserveAddress),
    )
  );
}

function hasSameApprovalTokenScope(
  launched: IBorrowEModeBlockerAsset,
  latest: IBorrowEModeBlockerAsset,
): boolean {
  return (
    launched.token.address.toLowerCase() ===
      latest.token.address.toLowerCase() &&
    launched.token.decimals === latest.token.decimals &&
    Boolean(launched.token.isNative) === Boolean(latest.token.isNative)
  );
}

export function createApprovalRepayContext({
  step,
  check,
}: {
  step: IEModeStep | null | undefined;
  check: IBorrowEModeSwitchCheck | null | undefined;
}): IEModeApprovalRepayContext | null {
  const asset = findRepayBlockerAsset({ check, step });
  if (step?.kind !== 'repay' || !asset) {
    return null;
  }
  return { step, asset };
}

export function resolveRepayApprovalScope({
  launched,
  activeStep,
  check,
}: {
  launched: IEModeApprovalRepayContext | null;
  activeStep: IEModeStep | null | undefined;
  check: IBorrowEModeSwitchCheck | null | undefined;
}): IEModeApprovalRepayContext | null {
  return launched ?? createApprovalRepayContext({ step: activeStep, check });
}

export function resolveApprovedRepayStep({
  launched,
  latestCheck,
  networkId,
}: {
  launched: IEModeApprovalRepayContext;
  latestCheck: IBorrowEModeSwitchCheck | null | undefined;
  networkId: string;
}): IEModeStep | undefined {
  const latestAsset = findRepayBlockerAsset({
    check: latestCheck,
    step: launched.step,
  });
  if (!latestAsset || !hasSameApprovalTokenScope(launched.asset, latestAsset)) {
    return undefined;
  }
  const latestStep = blockerSteps(
    buildNeedActionItems(latestCheck),
    networkId,
  ).find(
    (step) =>
      step.kind === 'repay' &&
      isSameReserveAddress(step.reserveAddress, launched.step.reserveAddress),
  );
  if (!latestStep) {
    return undefined;
  }

  const launchedRepayAll = shouldRepayAllForEModeStep(launched.step);
  if (shouldRepayAllForEModeStep(latestStep) !== launchedRepayAll) {
    return undefined;
  }
  if (!launchedRepayAll) {
    const approvedAmount = new BigNumber(launched.step.amountValue ?? '');
    const latestAmount = new BigNumber(latestStep.amountValue ?? '');
    if (
      !approvedAmount.isFinite() ||
      !latestAmount.isFinite() ||
      latestAmount.gt(approvedAmount)
    ) {
      return undefined;
    }
  }
  return latestStep;
}
