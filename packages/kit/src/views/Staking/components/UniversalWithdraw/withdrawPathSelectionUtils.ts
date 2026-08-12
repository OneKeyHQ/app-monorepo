import type { IEarnWithdrawType } from '@onekeyhq/shared/types/staking';

type IWithdrawPathBox = {
  withdrawType?: IEarnWithdrawType;
  disabled?: boolean;
};

export type IManualWithdrawPathSelection = {
  index: number;
  withdrawType?: IEarnWithdrawType;
};

export function getEffectiveSelectedWithdrawPathIndex({
  boxes,
  manualSelection,
  selectedIndex,
}: {
  boxes: IWithdrawPathBox[];
  manualSelection?: IManualWithdrawPathSelection;
  selectedIndex: number;
}) {
  if (boxes.length <= 1) return 0;

  if (manualSelection) {
    const indexByType = manualSelection.withdrawType
      ? boxes.findIndex(
          (box) => box.withdrawType === manualSelection.withdrawType,
        )
      : -1;
    const manualIndex = indexByType >= 0 ? indexByType : manualSelection.index;
    if (manualIndex >= 0 && !boxes[manualIndex]?.disabled) {
      return manualIndex;
    }
  }

  const firstEnabledIndex = boxes.findIndex((box) => !box.disabled);
  if (firstEnabledIndex >= 0) return firstEnabledIndex;

  return Math.min(Math.max(selectedIndex, 0), boxes.length - 1);
}

export function getSelectedWithdrawType({
  isCancelWithdrawal,
  requiresEarnWithdrawPath,
  selectedIndex,
  selectedWithdrawPath,
}: {
  isCancelWithdrawal: boolean;
  requiresEarnWithdrawPath: boolean;
  selectedIndex: number;
  selectedWithdrawPath?: IWithdrawPathBox;
}): IEarnWithdrawType | undefined {
  if (isCancelWithdrawal) return 'cancel';

  if (selectedWithdrawPath?.withdrawType) {
    return selectedWithdrawPath.withdrawType;
  }

  if (!requiresEarnWithdrawPath) return undefined;

  if (selectedIndex === 0) return 'instant';
  if (selectedIndex === 1) return 'queued';

  return undefined;
}
