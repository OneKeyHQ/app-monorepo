import { SizableText, Stack, YStack } from '@onekeyhq/components';

import type { ILoanLtvBarProps } from './loanLtvBar.types';

const TRACK_HEIGHT = 6;

const toPercent = (value: number) =>
  `${Math.max(0, Math.min(1, value)) * 100}%` as const;

/**
 * The same bar on the phone apps, shown without a thumb: the loan is typed
 * there (the router is a desktop and web page)
 */
export function LoanLtvBar({ bar, tone, capLabel, testID }: ILoanLtvBarProps) {
  const toneColor = {
    success: '$iconSuccess',
    caution: '$iconCaution',
    critical: '$iconCritical',
  } as const;
  const used = bar && !bar.isPreview ? bar.used : 0;
  return (
    <YStack testID={testID} gap="$1.5" py="$2">
      <Stack
        h={TRACK_HEIGHT}
        borderRadius="$full"
        bg="$neutral5"
        overflow="hidden"
      >
        {bar?.cap !== undefined ? (
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={toPercent(bar.cap)}
            right={0}
            bg="$neutral3"
          />
        ) : null}
        {used > 0 ? (
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={0}
            w={toPercent(used)}
            bg="$neutral8"
          />
        ) : null}
        {bar && bar.value > used ? (
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={toPercent(used)}
            w={toPercent(Math.min(1, bar.value) - used)}
            bg={toneColor[tone]}
          />
        ) : null}
      </Stack>
      {capLabel ? (
        <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
          {capLabel}
        </SizableText>
      ) : null}
    </YStack>
  );
}
