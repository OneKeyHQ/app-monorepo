import { useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITooltipRef } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DottedUnderlineText } from '../../../Staking/components/ProtocolDetails/DottedUnderline';

import { LOAN_BAR_SURFACES, useLoanToneColors } from './loanToneColors';

import type { ILoanLtvTone } from './loanLtvBar.types';

const LEGEND_WIDTH = 224;
const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];
const LEGEND_CONTENT_PROPS = {
  p: '$4',
  borderRadius: '$3',
  maxWidth: LEGEND_WIDTH + 32,
} as const;

/**
 * A label that explains itself: the app's dotted rule under it, and what it
 * stands for drawn in a small window while the pointer (or the keyboard's
 * focus) is on it. The form keeps its few words; the picture is one hover
 * away
 */
export function LoanLegendLabel({
  testID,
  label,
  legend,
}: {
  testID?: string;
  label: string;
  legend: ReactNode;
}) {
  // The tooltip opens on hover alone; the keyboard's focus opens it by hand
  const tooltipRef = useRef<ITooltipRef>({
    closeTooltip: () => Promise.resolve(),
    openTooltip: () => Promise.resolve(),
  });
  const handleFocus = useCallback(() => {
    void tooltipRef.current.openTooltip();
  }, []);
  const handleBlur = useCallback(() => {
    void tooltipRef.current.closeTooltip();
  }, []);
  return (
    <Tooltip
      ref={tooltipRef}
      hovering
      // Above the label: what it explains sits right under the label and
      // stays in view next to its picture
      placement="top-start"
      contentProps={LEGEND_CONTENT_PROPS}
      renderContent={legend}
      renderTrigger={
        <Stack
          testID={testID}
          borderRadius="$1"
          {...(platformEnv.isRuntimeBrowser
            ? {
                tabIndex: 0,
                onFocus: handleFocus,
                onBlur: handleBlur,
                focusVisibleStyle: {
                  outlineColor: '$focusRing',
                  outlineWidth: 2,
                  outlineStyle: 'solid',
                  outlineOffset: 2,
                },
              }
            : undefined)}
        >
          <DottedUnderlineText
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
          >
            {label}
          </DottedUnderlineText>
        </Stack>
      }
    />
  );
}

// A legend's line: the part's own color, its name, and its figure here
function LegendRow({
  swatch,
  label,
  value,
}: {
  swatch: ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <XStack ai="center" gap="$2" minHeight="$5">
      <XStack w="$2" h="$2" ai="center" jc="center" flexShrink={0}>
        {swatch}
      </XStack>
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        flex={1}
        numberOfLines={1}
      >
        {label}
      </SizableText>
      {value ? (
        <SizableText size="$bodyMdMedium" fontVariant={TABULAR_NUMS}>
          {value}
        </SizableText>
      ) : null}
    </XStack>
  );
}

const Swatch = ({ color }: { color: string }) => (
  <Stack w="$2" h="$2" borderRadius="$0.5" backgroundColor={color} />
);

// The sample bar's parts, as shares of its width: wide enough each to be
// told apart, whatever the position's own figures are
const SAMPLE = { used: 0.26, value: 0.46, cap: 0.62, liquidation: 0.8 };
const SAMPLE_TRACK_HEIGHT = 6;
const SAMPLE_THUMB = 12;
const SAMPLE_HEIGHT = 16;
const toPercent = (share: number) => `${share * 100}%` as const;

/**
 * What the LTV bar's parts stand for: the bar in small with every part in
 * view, and under it each part's color, name and figure for this loan
 */
export function LoanLtvLegend({
  tone,
  borrowed,
  loan,
  maxLtv,
  liquidationLtv,
}: {
  // The health factor the loan leaves: the loan's color on the bar
  tone: ILoanLtvTone;
  // What is borrowed in the market already; none, the bar has no grey part
  borrowed?: string;
  loan?: string;
  maxLtv?: string;
  liquidationLtv?: string;
}) {
  const intl = useIntl();
  const { fill } = useLoanToneColors();
  const surfaces =
    LOAN_BAR_SURFACES[useThemeVariant() === 'light' ? 'light' : 'dark'];
  const hasBorrowed = Boolean(borrowed);
  const usedEnd = hasBorrowed ? SAMPLE.used : 0;
  const bandTop = (SAMPLE_HEIGHT - SAMPLE_TRACK_HEIGHT) / 2;
  return (
    <YStack w={LEGEND_WIDTH} gap="$3">
      <Stack h={SAMPLE_HEIGHT} aria-hidden>
        <Stack
          position="absolute"
          left={0}
          right={0}
          top={bandTop}
          h={SAMPLE_TRACK_HEIGHT}
          borderRadius="$full"
          overflow="hidden"
          backgroundColor={surfaces.track}
        >
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={toPercent(SAMPLE.cap)}
            right={0}
            backgroundColor={surfaces.locked}
          />
          {hasBorrowed ? (
            <Stack
              position="absolute"
              top={0}
              bottom={0}
              left={0}
              w={toPercent(usedEnd)}
              backgroundColor={surfaces.used}
            />
          ) : null}
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={toPercent(usedEnd)}
            w={toPercent(SAMPLE.value - usedEnd)}
            backgroundColor={fill[tone]}
          />
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={toPercent(SAMPLE.liquidation)}
            right={0}
            backgroundColor={fill.critical}
          />
        </Stack>
        <Stack
          position="absolute"
          top={1}
          bottom={1}
          left={toPercent(SAMPLE.cap)}
          w={2}
          ml={-1}
          borderRadius="$full"
          backgroundColor={surfaces.wall}
        />
        <Stack
          position="absolute"
          top={(SAMPLE_HEIGHT - SAMPLE_THUMB) / 2}
          left={toPercent(SAMPLE.value)}
          w={SAMPLE_THUMB}
          h={SAMPLE_THUMB}
          ml={-SAMPLE_THUMB / 2}
          borderRadius="$full"
          backgroundColor={surfaces.thumb}
          borderWidth={0.5}
          borderColor="$borderSubdued"
        />
      </Stack>
      <YStack gap="$1">
        {hasBorrowed ? (
          <LegendRow
            swatch={<Swatch color={surfaces.used} />}
            label={intl.formatMessage({ id: ETranslations.defi_borrowed })}
            value={borrowed}
          />
        ) : null}
        <LegendRow
          swatch={<Swatch color={fill[tone]} />}
          label={intl.formatMessage({ id: ETranslations.global_borrow })}
          value={loan}
        />
        <LegendRow
          swatch={
            <Stack
              w={2}
              h="$2.5"
              borderRadius="$full"
              backgroundColor={surfaces.wall}
            />
          }
          label={intl.formatMessage({ id: ETranslations.defi_max_ltv })}
          value={maxLtv}
        />
        <LegendRow
          swatch={<Swatch color={fill.critical} />}
          label={intl.formatMessage({
            id: ETranslations.defi_liquidation_ltv,
          })}
          value={liquidationLtv}
        />
      </YStack>
    </YStack>
  );
}

// The health factor's tiers, low to high: the share of the sample scale
// each takes, the word the Borrow page has for it, and its range
const HEALTH_TIERS: {
  tone: ILoanLtvTone;
  share: number;
  word: ETranslations;
  range: string;
}[] = [
  {
    tone: 'critical',
    share: 0.2,
    word: ETranslations.perp_portfolio_health_status_high_risk,
    range: '< 1.10',
  },
  {
    tone: 'caution',
    share: 0.3,
    word: ETranslations.perp_portfolio_health_status_moderate,
    range: '1.10 - 1.49',
  },
  {
    tone: 'success',
    share: 0.5,
    word: ETranslations.perp_portfolio_health_status_healthy,
    range: '≥ 1.50',
  },
];

/**
 * What a health factor says: its three tiers on one scale, in the colors
 * the figure and its badge take, and the app's line for where the
 * collateral is sold
 */
export function LoanHealthLegend() {
  const intl = useIntl();
  const { fill } = useLoanToneColors();
  return (
    <YStack w={LEGEND_WIDTH} gap="$3">
      <XStack
        h={SAMPLE_TRACK_HEIGHT}
        my={(SAMPLE_HEIGHT - SAMPLE_TRACK_HEIGHT) / 2}
        gap={2}
        aria-hidden
      >
        {HEALTH_TIERS.map((tier) => (
          <Stack
            key={tier.tone}
            flexGrow={tier.share}
            flexBasis={0}
            borderRadius="$full"
            backgroundColor={fill[tier.tone]}
          />
        ))}
      </XStack>
      <YStack gap="$1">
        {HEALTH_TIERS.map((tier) => (
          <LegendRow
            key={tier.tone}
            swatch={<Swatch color={fill[tier.tone]} />}
            label={intl.formatMessage({ id: tier.word })}
            value={tier.range}
          />
        ))}
      </YStack>
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.defi_liquidation_at_less_than_1_00,
        })}
      </SizableText>
    </YStack>
  );
}
