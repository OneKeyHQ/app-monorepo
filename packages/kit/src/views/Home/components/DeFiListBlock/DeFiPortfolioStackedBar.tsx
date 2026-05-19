import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  SizableText,
  Skeleton,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { NetworkAvatarGroup } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { buildStackedBarSegments } from './DeFiPortfolioStackedBarLayout';
import { PORTFOLIO_OTHERS_KEY } from './DeFiPortfolioStats';
import { formatPortfolioPercent } from './formatPortfolioPercent';

import type { IPortfolioSlice } from './DeFiPortfolioStats';

export type IDeFiPortfolioStackedBarProps = {
  slices: IPortfolioSlice[];
  height?: number;
  gap?: number;
  isLoading?: boolean;
};

const DEFAULT_HEIGHT = 16;
/**
 * A one-pixel track seam keeps adjacent colors readable without turning
 * each segment into its own pill.
 */
const DEFAULT_GAP = 1;

/**
 * GitHub language-bar inspired chrome: one continuous shell, no inner
 * rounding, no raised slices.
 */
const STACKED_BAR_SHELL_SHADOW =
  'inset 0 0 0 1px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.28)';

/**
 * Chrome shared by all three states (loading / empty / loaded) so the
 * load → render transition has zero shape jump. Only the bar's
 * *contents* (skeleton shimmer / strong-neutral fill / segments) swap.
 * Border radius is excluded because Skeleton uses a different prop
 * name; each call site applies it explicitly.
 */
const STACKED_BAR_CHROME = {
  borderCurve: 'continuous',
  width: '100%',
  overflow: 'hidden',
  '$platform-web': {
    boxShadow: STACKED_BAR_SHELL_SHADOW,
  },
  '$platform-native': {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '$borderSubdued',
  },
  '$theme-dark': {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '$borderSubdued',
  },
} as const;

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

const SEGMENT_OPACITY = 0.86;

function buildA11yLabel(
  segments: ReturnType<typeof buildStackedBarSegments>,
  allocationLabel: string,
): string {
  if (segments.length === 0) return allocationLabel;
  const parts = segments.map(
    (s) => `${s.sliceLabel} ${formatPortfolioPercent(s.flexBasis, s.netWorth)}`,
  );
  return `${allocationLabel}: ${parts.join(', ')}`;
}

function renderTooltipContent(
  seg: ReturnType<typeof buildStackedBarSegments>[number],
) {
  const showChainRow = seg.networkIds.length > 1;
  return (
    <Stack px="$2" py="$1.5" gap="$2">
      <XStack alignItems="center" gap="$2">
        <Stack
          width="$2"
          height="$2"
          borderRadius="$full"
          bg={seg.colorToken}
          flexShrink={0}
        />
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {seg.sliceLabel}
        </SizableText>
      </XStack>
      {showChainRow ? (
        <NetworkAvatarGroup
          networkIds={seg.networkIds}
          size="$5"
          variant="overlapped"
        />
      ) : null}
      <SizableText size="$bodySm" color="$textSubdued">
        {formatPortfolioPercent(seg.flexBasis, seg.netWorth)}
      </SizableText>
    </Stack>
  );
}

function DeFiPortfolioStackedBar({
  slices,
  height = DEFAULT_HEIGHT,
  gap = DEFAULT_GAP,
  isLoading,
}: IDeFiPortfolioStackedBarProps) {
  const intl = useIntl();
  const allocationLabel = intl.formatMessage({
    id: ETranslations.defi_allocation,
  });
  const othersLabel = intl.formatMessage({
    id: ETranslations.global_others,
  });
  const segments = useMemo(
    () =>
      buildStackedBarSegments(slices).map((seg) =>
        seg.key === PORTFOLIO_OTHERS_KEY
          ? { ...seg, sliceLabel: othersLabel }
          : seg,
      ),
    [slices, othersLabel],
  );

  if (isLoading) {
    return (
      <YStack gap="$2" width="100%">
        <Skeleton height={height} radius={8} {...STACKED_BAR_CHROME} />
        <XStack gap="$3" rowGap="$1.5" flexWrap="wrap">
          <Skeleton height={14} radius={7} width={104} />
          <Skeleton height={14} radius={7} width={92} />
          <Skeleton height={14} radius={7} width={116} />
        </XStack>
      </YStack>
    );
  }

  if (segments.length === 0) {
    return (
      <Stack
        height={height}
        borderRadius="$2"
        bg="$bgSubdued"
        accessibilityRole="image"
        accessibilityLabel={allocationLabel}
        {...STACKED_BAR_CHROME}
      >
        <Stack flex={1} bg="$bgStrong" opacity={0.42} />
      </Stack>
    );
  }

  return (
    <YStack gap="$2" width="100%">
      <XStack
        height={height}
        borderRadius="$2"
        bg="$bgSubdued"
        accessibilityRole="image"
        accessibilityLabel={buildA11yLabel(segments, allocationLabel)}
        {...STACKED_BAR_CHROME}
      >
        {segments.map((seg, index) => (
          <XStack
            key={seg.key}
            flexBasis={`${seg.flexBasis}%`}
            flexGrow={0}
            flexShrink={0}
            alignItems="stretch"
          >
            {index > 0 ? <Stack width={gap} flexShrink={0} /> : null}
            <Stack
              flex={1}
              minWidth={0}
              bg={seg.colorToken}
              opacity={SEGMENT_OPACITY}
              overflow="hidden"
              position="relative"
            >
              <Tooltip
                renderContent={renderTooltipContent(seg)}
                renderTrigger={
                  <Stack
                    position="absolute"
                    left={0}
                    top={0}
                    right={0}
                    bottom={0}
                    cursor="default"
                  />
                }
              />
            </Stack>
          </XStack>
        ))}
      </XStack>
      <XStack gap="$3" rowGap="$1.5" flexWrap="wrap" alignItems="center">
        {segments.map((seg) => (
          <Tooltip
            key={`legend-${seg.key}`}
            renderContent={renderTooltipContent(seg)}
            renderTrigger={
              <XStack
                alignItems="center"
                gap="$1.5"
                minWidth={0}
                maxWidth={176}
                cursor="default"
                $platform-web={{
                  transition: 'opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
                hoverStyle={{ opacity: 0.78 }}
              >
                <Stack
                  width="$2"
                  height="$2"
                  borderRadius="$full"
                  bg={seg.colorToken}
                  opacity={SEGMENT_OPACITY}
                  flexShrink={0}
                  $platform-web={{
                    boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.06)',
                  }}
                />
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  minWidth={0}
                >
                  {seg.sliceLabel}
                </SizableText>
                <SizableText
                  size="$bodyMdMedium"
                  color="$text"
                  selectable={false}
                  numberOfLines={1}
                  fontVariant={TABULAR_NUMS}
                  flexShrink={0}
                >
                  {seg.label}
                </SizableText>
              </XStack>
            }
          />
        ))}
      </XStack>
    </YStack>
  );
}

DeFiPortfolioStackedBar.displayName = 'DeFiPortfolioStackedBar';

const MemoDeFiPortfolioStackedBar = memo(DeFiPortfolioStackedBar);
MemoDeFiPortfolioStackedBar.displayName = 'DeFiPortfolioStackedBar';

export { MemoDeFiPortfolioStackedBar as DeFiPortfolioStackedBar };
