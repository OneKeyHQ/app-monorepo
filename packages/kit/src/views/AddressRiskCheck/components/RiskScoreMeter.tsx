import { useIntl } from 'react-intl';

import { Popover, SizableText, XStack, YStack } from '@onekeyhq/components';
import {
  KYT_LEVEL_SOLID_COLOR,
  KYT_LEVEL_TEXT_COLOR,
} from '@onekeyhq/kit/src/utils/kytRiskLevelColorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';

import {
  RISK_SCORE_BANDS,
  getRiskScoreMeterPosition,
} from '../utils/addressRiskCheckResultUtils';

import { LEVEL_TITLE } from './RiskCheckShared';

function formatBandRange(band: (typeof RISK_SCORE_BANDS)[number]) {
  const min = band.min === 0 ? 0 : band.min + 1;
  return `${min}–${band.max}`;
}

function RiskScoreTooltipContent() {
  const intl = useIntl();
  return (
    <YStack px="$5" pb="$5" pt={platformEnv.isNative ? '$0' : '$5'} gap="$4">
      <SizableText size="$bodyMd">
        {intl.formatMessage({
          id: ETranslations.address_risk_check_score_tooltip__desc,
        })}
      </SizableText>
      <YStack gap="$2">
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.address_risk_check_score_ranges__title,
          })}
        </SizableText>
        {RISK_SCORE_BANDS.map((band) => (
          <XStack key={band.level} ai="center" jc="space-between" gap="$4">
            <XStack ai="center" gap="$2">
              <YStack
                w="$2"
                h="$2"
                borderRadius="$full"
                bg={KYT_LEVEL_SOLID_COLOR[band.level]}
              />
              <SizableText size="$bodyMd">
                {intl.formatMessage({ id: LEVEL_TITLE[band.level] })}
              </SizableText>
            </XStack>
            <SizableText size="$bodyMd" color="$textSubdued">
              {formatBandRange(band)}
            </SizableText>
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

// Static element so the popover keeps a stable content reference across
// parent re-renders.
const RISK_SCORE_TOOLTIP_CONTENT = <RiskScoreTooltipContent />;

// Stable reference so the tooltip trigger stays memoized.
const SCORE_INFO_TRIGGER_PROPS = { testID: 'address-risk-check-score-info' };

export function RiskScoreMeter({
  score,
  level,
}: {
  score: number;
  level: EKytRiskLevel;
}) {
  const intl = useIntl();
  const { positionPercent, bandIndex } = getRiskScoreMeterPosition(score);
  // Trust the server level for highlighting; fall back to the score band when
  // the level is outside the four scored bands.
  const levelIndex = RISK_SCORE_BANDS.findIndex((band) => band.level === level);
  const highlightIndex = levelIndex >= 0 ? levelIndex : bandIndex;
  const scoreTitle = intl.formatMessage({
    id: ETranslations.address_risk_check_score__title,
  });

  return (
    <YStack gap="$2.5">
      <XStack ai="center" jc="space-between">
        <XStack ai="center" gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {scoreTitle}
          </SizableText>
          <Popover.Tooltip
            title={scoreTitle}
            placement="bottom"
            iconSize="$4"
            renderContent={RISK_SCORE_TOOLTIP_CONTENT}
            triggerProps={SCORE_INFO_TRIGGER_PROPS}
          />
        </XStack>
        <SizableText size="$headingMd">
          {Math.round(score)}
          <SizableText size="$bodyMd" color="$textSubdued">
            /100
          </SizableText>
        </SizableText>
      </XStack>

      <YStack>
        <XStack gap="$0.5" h="$1.5">
          {RISK_SCORE_BANDS.map((band, index) => (
            <YStack
              key={band.level}
              flex={1}
              borderRadius="$full"
              bg={
                index === highlightIndex
                  ? KYT_LEVEL_SOLID_COLOR[band.level]
                  : '$neutral3'
              }
            />
          ))}
        </XStack>
        <YStack
          position="absolute"
          top={-4}
          left={`${positionPercent}%`}
          ml={-3}
          w={6}
          h={14}
          borderRadius="$full"
          bg="$text"
          borderWidth={1.5}
          borderColor="$bgSubdued"
        />
      </YStack>

      <XStack>
        {RISK_SCORE_BANDS.map((band, index) => {
          const isActive = index === highlightIndex;
          return (
            <SizableText
              key={band.level}
              flex={1}
              textAlign="center"
              size={isActive ? '$bodySmMedium' : '$bodySm'}
              color={
                isActive ? KYT_LEVEL_TEXT_COLOR[band.level] : '$textSubdued'
              }
              numberOfLines={1}
            >
              {intl.formatMessage({ id: LEVEL_TITLE[band.level] })}
            </SizableText>
          );
        })}
      </XStack>
    </YStack>
  );
}
