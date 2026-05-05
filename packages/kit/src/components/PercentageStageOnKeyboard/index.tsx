import BigNumber from 'bignumber.js';

import { XStack, useIsKeyboardShown } from '@onekeyhq/components';
import SwapPercentageStageBadge from '@onekeyhq/kit/src/views/Swap/components/SwapPercentageStageBadge';

const countLeadingZeroDecimals = (value: string) => {
  const num = new BigNumber(value);
  if (num.isZero() || num.isNaN()) return 0;
  const jsNum = num.abs().toNumber();
  // Guard against sub-normal underflow to 0 (e.g. 1e-400)
  if (jsNum === 0) return 0;
  const counts = -Math.floor(Math.log10(jsNum) + 1);
  return counts > 0 ? counts : 0;
};

export const PercentageInputStageForNative = [25, 50, 75, 100];

export const calcPercentBalance = ({
  balance,
  percent,
  decimals,
  compactResult,
}: {
  balance: string;
  percent: number;
  decimals?: number;
  compactResult?: boolean;
}) => {
  const valueNumber = BigNumber(balance);

  // Empty value handling
  if (valueNumber.isZero()) {
    return '';
  }

  // 100% keeps full precision to ensure the entire balance can be sent
  if (percent === 100) {
    return decimals !== null && decimals !== undefined
      ? valueNumber.decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed()
      : balance;
  }

  // Calculate percentage value
  const value = valueNumber.multipliedBy(percent).dividedBy(100);

  if (!compactResult) {
    return decimals !== null && decimals !== undefined
      ? value.decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed()
      : value.toFixed();
  }

  // Apply display rules for decimal formatting
  let targetDecimals: number;

  if (value.gte(1)) {
    // value >= 1: use 4 decimal places
    targetDecimals = 4;
  } else {
    // value < 1: use (4 + leading zero count) decimal places
    const leadingZeros = countLeadingZeroDecimals(value.toFixed());
    targetDecimals = 4 + leadingZeros;
  }

  // Respect token decimals as upper limit
  if (decimals !== undefined) {
    targetDecimals = Math.min(targetDecimals, decimals);
  }

  // Apply decimal places and remove trailing zeros
  const formatted = value.decimalPlaces(targetDecimals, BigNumber.ROUND_DOWN);

  let result = formatted.toFixed();
  if (result.includes('.')) {
    result = result.replace(/\.?0+$/, '');
    if (result.endsWith('.')) {
      result = result.slice(0, -1);
    }
  }

  return result;
};
export function PercentageStageOnKeyboard({
  onSelectPercentageStage,
}: {
  onSelectPercentageStage?: (stage: number) => void;
}) {
  const isShow = useIsKeyboardShown();
  return isShow ? (
    <XStack
      alignItems="center"
      gap="$1"
      justifyContent="space-around"
      bg="$bgSubdued"
      h="$10"
    >
      <>
        {PercentageInputStageForNative.map((stage) => (
          <SwapPercentageStageBadge
            badgeSize="lg"
            key={`swap-percentage-input-stage-${stage}`}
            stage={stage}
            borderRadius={0}
            onSelectStage={onSelectPercentageStage}
            flex={1}
            justifyContent="center"
            alignItems="center"
            h="$10"
          />
        ))}
      </>
    </XStack>
  ) : null;
}
