import { Stack } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { LOAN_BAR_SURFACES, useLoanToneColors } from './loanToneColors';

import type { ILoanLtvTone } from './loanLtvBar.types';

const clamp = (share: number) => Math.min(1, Math.max(0, share));
const toPercent = (share: number) => `${clamp(share) * 100}%` as const;

/**
 * The LTV bar in small, to be read and not moved: what is borrowed already
 * in grey, the loan in the color of the health factor it leaves, the limit
 * as a tick, and where the collateral is sold in red. The hover legend draws
 * a sample with it, and each market card the loan as it would sit there
 */
export function LoanLtvMiniBar({
  used = 0,
  value,
  cap,
  liquidation,
  tone,
  height = 16,
  trackHeight = 6,
  thumbSize = 12,
  isQuiet,
  isDim,
}: {
  // Shares of the bar's width: the debt already there, then with this loan
  used?: number;
  value?: number;
  // The most the loan may be, and where the market sells the collateral
  cap?: number;
  liquidation?: number;
  tone: ILoanLtvTone;
  height?: number;
  trackHeight?: number;
  thumbSize?: number;
  // One of several on a page: the red steps back, as the form's own bar's
  // does, so the loan's color leads
  isQuiet?: boolean;
  // A market that can't take the loan: the bar steps back with its card
  isDim?: boolean;
}) {
  const { fill } = useLoanToneColors();
  const surfaces =
    LOAN_BAR_SURFACES[useThemeVariant() === 'light' ? 'light' : 'dark'];
  // Without a loan the bar keeps what is borrowed there already
  const usedEnd =
    value === undefined ? clamp(used) : Math.min(clamp(used), clamp(value));
  return (
    <Stack h={height} opacity={isDim ? 0.5 : 1} aria-hidden>
      <Stack
        position="absolute"
        left={0}
        right={0}
        top={(height - trackHeight) / 2}
        h={trackHeight}
        borderRadius="$full"
        overflow="hidden"
        backgroundColor={surfaces.track}
      >
        {cap !== undefined ? (
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={toPercent(cap)}
            right={0}
            backgroundColor={surfaces.locked}
          />
        ) : null}
        {usedEnd > 0 ? (
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={0}
            w={toPercent(usedEnd)}
            backgroundColor={surfaces.used}
          />
        ) : null}
        {value !== undefined && clamp(value) > usedEnd ? (
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={toPercent(usedEnd)}
            w={toPercent(clamp(value) - usedEnd)}
            backgroundColor={fill[tone]}
          />
        ) : null}
        {liquidation !== undefined && liquidation < 1 ? (
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={toPercent(liquidation)}
            right={0}
            backgroundColor={fill.critical}
            opacity={isQuiet ? 0.55 : 1}
          />
        ) : null}
      </Stack>
      {cap !== undefined ? (
        <Stack
          position="absolute"
          top={1}
          bottom={1}
          left={toPercent(cap)}
          w={2}
          ml={-1}
          borderRadius="$full"
          backgroundColor={surfaces.wall}
        />
      ) : null}
      {value !== undefined && value > 0 ? (
        <Stack
          position="absolute"
          top={(height - thumbSize) / 2}
          left={toPercent(value)}
          w={thumbSize}
          h={thumbSize}
          ml={-thumbSize / 2}
          borderRadius="$full"
          backgroundColor={surfaces.thumb}
          // The form's thumb's own edge, which keeps a white dot in view on
          // a light card; a hairline where there are no shadows
          {...(platformEnv.isNative
            ? { borderWidth: 0.5, borderColor: '$borderSubdued' }
            : { style: { boxShadow: surfaces.thumbShadow } })}
        />
      ) : null}
    </Stack>
  );
}
