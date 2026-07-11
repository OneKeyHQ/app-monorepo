import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type {
  IEarnText,
  IEarnTransactionTip,
  IEarnWithdrawType,
} from '@onekeyhq/shared/types/staking';

export type IWithdrawPathBox = {
  title: IEarnText;
  description: IEarnText;
  subtitle?: IEarnText;
  subtitleDescription?: IEarnText;
  withdrawType?: IEarnWithdrawType;
  disabled?: boolean;
  tip?: IEarnTransactionTip;
};

export function clampWithdrawPathIndex({
  selectedIndex,
  boxesLength,
}: {
  selectedIndex: number;
  boxesLength: number;
}): number {
  if (boxesLength <= 1) return 0;
  return Math.min(Math.max(selectedIndex, 0), boxesLength - 1);
}

export function resolveSelectedWithdrawPath({
  boxes,
  selectedIndex,
}: {
  boxes: IWithdrawPathBox[];
  selectedIndex: number;
}): IWithdrawPathBox | undefined {
  if (!boxes.length) return undefined;
  const effectiveIndex = clampWithdrawPathIndex({
    selectedIndex,
    boxesLength: boxes.length,
  });
  return boxes[effectiveIndex] ?? boxes[0];
}

export function shouldConfirmNativeInstantWithdrawFee({
  providerName,
  isCancelWithdrawal,
  withdrawType,
}: {
  providerName: string;
  isCancelWithdrawal: boolean;
  withdrawType?: IEarnWithdrawType;
}): boolean {
  return (
    earnUtils.isNativeProvider({ providerName }) &&
    !isCancelWithdrawal &&
    withdrawType === 'instant'
  );
}
