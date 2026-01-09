import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { ColorTokens } from '@tamagui/core';

// ============================================================================
// Constants
// ============================================================================

export const CHART_HEIGHT = 280;

// Base timestamp and range for mapping utilization (0-1) to time axis
export const BASE_TIMESTAMP = 1_000_000_000;
export const UTILIZATION_RANGE = 1_000_000;

// Theme colors for chart series
export const INTEREST_RATE_CHART_COLORS = {
  supply: {
    line: '#008347D6',
    top: '#00834726',
    bottom: '#00834700',
  },
  borrow: {
    line: '#DA8A00C9',
    top: '#DA8A0026',
    bottom: '#DA8A0000',
  },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

export const normalizeUtilization = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value > 1 ? value / 100 : value;
};

export const normalizeApyToPercent = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
};

export const convertUtilizationToTime = (util: number): number => {
  const clampedUtil = Math.max(0, Math.min(1, util));
  return BASE_TIMESTAMP + Math.round(clampedUtil * UTILIZATION_RANGE);
};

export const convertTimeToUtilization = (time: number): number => {
  const util = (time - BASE_TIMESTAMP) / UTILIZATION_RANGE;
  return Math.max(0, Math.min(1, util));
};

export const calculatePopoverPosition = (
  hoverX: number,
  hoverY: number,
  containerWidth: number,
  popoverWidth = 144,
  offset = 10,
  edgePadding = 16,
): { left: number; translateXValue: number; top: number } | null => {
  if (!containerWidth) return null;

  const isLeftHalf = hoverX < containerWidth / 2;
  const translateXValue = isLeftHalf ? 0 : -popoverWidth;
  const desiredLeft = isLeftHalf ? hoverX + offset : hoverX - offset;
  const minLeft = edgePadding;
  const maxLeft = Math.max(
    minLeft,
    containerWidth - popoverWidth - edgePadding,
  );
  const actualLeft = desiredLeft + translateXValue;
  const clampedActualLeft = Math.min(Math.max(actualLeft, minLeft), maxLeft);

  return {
    left: clampedActualLeft - translateXValue,
    translateXValue,
    top: Math.max(10, hoverY - 70),
  };
};

// ============================================================================
// Types
// ============================================================================

export interface IInterestRateModelChartProps {
  borrowCurve: [number, string][];
  supplyCurve: [number, string][];
  utilizationRatio?: string;
  isLoading?: boolean;
}

export interface IHoverData {
  utilizationRatio: number;
  supplyApy: number;
  borrowApy: number;
  x: number;
  y: number;
}

// ============================================================================
// Hooks
// ============================================================================

export function useInterestRateModelLabels() {
  const intl = useIntl();

  const utilizationRatioLabel = useMemo(
    () => intl.formatMessage({ id: ETranslations.defi_utilization_ratio }),
    [intl],
  );
  const currentUtilizationLabel = useMemo(
    () => intl.formatMessage({ id: ETranslations.defi_current_utilization }),
    [intl],
  );
  const supplyApyLabel = useMemo(
    () => intl.formatMessage({ id: ETranslations.defi_supply_apy }),
    [intl],
  );
  const borrowApyLabel = useMemo(
    () => intl.formatMessage({ id: ETranslations.defi_borrow_apy }),
    [intl],
  );

  return {
    utilizationRatioLabel,
    currentUtilizationLabel,
    supplyApyLabel,
    borrowApyLabel,
  };
}

// ============================================================================
// Shared Components
// ============================================================================

interface IInterestRateModelHeaderProps {
  utilizationPercentage: string;
  utilizationRatioLabel: string;
}

export function InterestRateModelHeader({
  utilizationPercentage,
  utilizationRatioLabel,
}: IInterestRateModelHeaderProps) {
  return (
    <SizableText size="$headingXl">
      {utilizationPercentage} {utilizationRatioLabel}
    </SizableText>
  );
}

interface IInterestRateModelLegendProps {
  borrowApyLabel: string;
  supplyApyLabel: string;
  currentUtilizationLabel: string;
}

export function InterestRateModelLegend({
  borrowApyLabel,
  supplyApyLabel,
  currentUtilizationLabel,
}: IInterestRateModelLegendProps) {
  return (
    <XStack gap="$3" ai="center">
      <XStack ai="center" gap="$1">
        <Icon
          name="CirclePlaceholderOnSolid"
          size="$1.5"
          color={INTEREST_RATE_CHART_COLORS.borrow.line as ColorTokens}
        />
        <SizableText size="$bodySm" color="$textSubdued">
          {borrowApyLabel}
        </SizableText>
      </XStack>
      <XStack ai="center" gap="$1">
        <Icon
          name="CirclePlaceholderOnSolid"
          size="$1.5"
          color={INTEREST_RATE_CHART_COLORS.supply.line as ColorTokens}
        />
        <SizableText size="$bodySm" color="$textSubdued">
          {supplyApyLabel}
        </SizableText>
      </XStack>
      <XStack ai="center" gap="$1">
        <Icon
          name="CirclePlaceholderOnSolid"
          size="$1.5"
          color="$iconSubdued"
        />
        <SizableText size="$bodySm" color="$textSubdued">
          {currentUtilizationLabel}
        </SizableText>
      </XStack>
    </XStack>
  );
}

interface IInterestRateModelTooltipProps {
  hoverData: IHoverData;
  popoverPosition: { left: number; translateXValue: number; top: number };
  utilizationRatioLabel: string;
  borrowApyLabel: string;
  supplyApyLabel: string;
}

export function InterestRateModelTooltip({
  hoverData,
  popoverPosition,
  utilizationRatioLabel,
  borrowApyLabel,
  supplyApyLabel,
}: IInterestRateModelTooltipProps) {
  return (
    <YStack
      position="absolute"
      top={popoverPosition.top}
      left={popoverPosition.left}
      transform={[{ translateX: popoverPosition.translateXValue }]}
      bg="$bg"
      borderRadius="$2"
      borderWidth={1}
      borderColor="$borderSubdued"
      px="$3"
      py="$2"
      shadowColor="$shadowDefault"
      shadowOffset={{ width: 0, height: 2 }}
      shadowOpacity={0.1}
      shadowRadius={8}
      zIndex={9999}
      pointerEvents="none"
      minWidth={144}
    >
      <YStack gap="$1.5">
        <XStack jc="space-between" ai="center" gap="$1.5">
          <SizableText size="$bodySm" color="$textSubdued" whiteSpace="nowrap">
            {utilizationRatioLabel}
          </SizableText>
          <SizableText size="$bodySmMedium" color="$text" whiteSpace="nowrap">
            {(hoverData.utilizationRatio * 100).toFixed(2)}%
          </SizableText>
        </XStack>
        <XStack jc="space-between" ai="center" gap="$1.5">
          <SizableText size="$bodySm" color="$textSubdued" whiteSpace="nowrap">
            {borrowApyLabel}
          </SizableText>
          <SizableText size="$bodySmMedium" color="$text" whiteSpace="nowrap">
            {hoverData.borrowApy.toFixed(2)}%
          </SizableText>
        </XStack>
        <XStack jc="space-between" ai="center" gap="$1.5">
          <SizableText size="$bodySm" color="$textSubdued" whiteSpace="nowrap">
            {supplyApyLabel}
          </SizableText>
          <SizableText size="$bodySmMedium" color="$text" whiteSpace="nowrap">
            {hoverData.supplyApy.toFixed(2)}%
          </SizableText>
        </XStack>
      </YStack>
    </YStack>
  );
}
