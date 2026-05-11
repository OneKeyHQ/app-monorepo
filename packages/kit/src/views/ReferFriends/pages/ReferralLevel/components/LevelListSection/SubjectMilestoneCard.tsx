import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { SizableText, Stack, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteLevelUpgradeCondition } from '@onekeyhq/shared/src/referralCode/type';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

interface ISubjectMilestones {
  upgrade?: IInviteLevelUpgradeCondition;
  retention?: IInviteLevelUpgradeCondition;
}

interface ISubjectMilestoneCardProps {
  subjectLabel: string;
  milestones: ISubjectMilestones;
  nextLevelLabel?: string;
  optionIndex?: number;
}

function formatFiatCompact(value: BigNumber) {
  return numberFormat(value.toFixed(), { formatter: 'marketCap' });
}

function formatFiatExact(value: BigNumber) {
  return value.isInteger() ? value.toFormat(0) : value.toFormat(2);
}

function clampPct(pct: number) {
  return Math.min(100, Math.max(0, pct));
}

const BAR_HEIGHT = 6;
const MILESTONE_DOT_SIZE = 8;
const CURRENT_DOT_SIZE = 12;

function MilestoneLabel({
  pct,
  title,
  value,
  align,
}: {
  pct: number;
  title: string;
  value: string;
  align: 'flex-start' | 'flex-end';
}) {
  const isStart = align === 'flex-start';
  const clamped = clampPct(pct);
  return (
    <YStack
      position="absolute"
      {...(isStart ? { left: `${clamped}%` } : { right: `${100 - clamped}%` })}
      gap="$0.5"
      ai={align}
    >
      <SizableText size="$bodySm" color="$textSubdued">
        {title}
      </SizableText>
      <SizableText size="$bodyMdMedium" color="$text">
        {value}
      </SizableText>
    </YStack>
  );
}

function ProgressBarWithMilestones({
  currentPct,
  maintainPct,
  upgradePct,
}: {
  currentPct: number;
  maintainPct: number | null;
  upgradePct: number | null;
}) {
  const clampedCurrent = clampPct(currentPct);
  return (
    <Stack
      h={BAR_HEIGHT}
      bg="$neutral5"
      borderRadius="$full"
      position="relative"
    >
      <Stack
        position="absolute"
        left={0}
        top={0}
        bottom={0}
        width={`${clampedCurrent}%`}
        bg="$iconSuccess"
        borderRadius="$full"
      />
      {maintainPct !== null ? (
        <Stack
          position="absolute"
          left={`${clampPct(maintainPct)}%`}
          ml={-MILESTONE_DOT_SIZE / 2}
          top={-(MILESTONE_DOT_SIZE - BAR_HEIGHT) / 2}
          w={MILESTONE_DOT_SIZE}
          h={MILESTONE_DOT_SIZE}
          borderRadius="$full"
          bg="$bg"
          borderWidth={1}
          borderColor="$borderSubdued"
        />
      ) : null}
      {upgradePct !== null ? (
        <Stack
          position="absolute"
          left={`${clampPct(upgradePct)}%`}
          ml={-MILESTONE_DOT_SIZE / 2}
          top={-(MILESTONE_DOT_SIZE - BAR_HEIGHT) / 2}
          w={MILESTONE_DOT_SIZE}
          h={MILESTONE_DOT_SIZE}
          borderRadius="$full"
          bg="$bg"
          borderWidth={1}
          borderColor="$borderSubdued"
        />
      ) : null}
      <Stack
        position="absolute"
        left={`${clampedCurrent}%`}
        ml={-CURRENT_DOT_SIZE / 2}
        top={-(CURRENT_DOT_SIZE - BAR_HEIGHT) / 2}
        w={CURRENT_DOT_SIZE}
        h={CURRENT_DOT_SIZE}
        borderRadius="$full"
        bg="$iconSuccess"
        borderWidth={2}
        borderColor="$bgApp"
      />
    </Stack>
  );
}

export function SubjectMilestoneCard({
  subjectLabel,
  milestones,
  nextLevelLabel,
  optionIndex,
}: ISubjectMilestoneCardProps) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const currencyCode = currencyInfo.id.toUpperCase();

  const reference = milestones.upgrade ?? milestones.retention;
  if (!reference) return null;

  const current = new BigNumber(reference.currentFiatValue ?? 0);
  const maintain = milestones.retention
    ? new BigNumber(milestones.retention.thresholdFiatValue ?? 0)
    : null;
  const upgrade = milestones.upgrade
    ? new BigNumber(milestones.upgrade.thresholdFiatValue ?? 0)
    : null;

  const upperBound = upgrade ?? maintain ?? current;
  const safeUpper = upperBound.isZero() ? new BigNumber(1) : upperBound;

  const currentPct = current.dividedBy(safeUpper).multipliedBy(100).toNumber();
  const maintainPct = maintain
    ? maintain.dividedBy(safeUpper).multipliedBy(100).toNumber()
    : null;
  const upgradePct = upgrade
    ? upgrade.dividedBy(safeUpper).multipliedBy(100).toNumber()
    : null;

  const maintainTitle = intl.formatMessage({
    id: ETranslations.referral_level_milestone_retention,
  });
  const upgradeTitle = nextLevelLabel ?? '';

  const optionLabel =
    optionIndex !== undefined
      ? intl.formatMessage(
          { id: ETranslations.referral_level_option_n },
          { n: optionIndex },
        )
      : null;

  return (
    <YStack
      gap="$3"
      flex={1}
      bg="$bgApp"
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral4"
      px="$4"
      py="$3"
      minWidth={0}
    >
      {optionLabel ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {optionLabel}
        </SizableText>
      ) : null}

      <YStack gap="$0.5">
        <SizableText size="$bodyMd" color="$textSubdued">
          {subjectLabel}
        </SizableText>
        <SizableText size="$headingMd" color="$text">
          {`${formatFiatExact(current)} ${currencyCode}`}
        </SizableText>
      </YStack>

      <YStack gap="$2">
        <ProgressBarWithMilestones
          currentPct={currentPct}
          maintainPct={maintainPct}
          upgradePct={upgradePct}
        />
        <Stack position="relative" minHeight="$10">
          {maintain && maintainPct !== null ? (
            <MilestoneLabel
              pct={maintainPct}
              title={maintainTitle}
              value={formatFiatCompact(maintain)}
              align={upgrade ? 'flex-start' : 'flex-end'}
            />
          ) : null}
          {upgrade && upgradePct !== null ? (
            <MilestoneLabel
              pct={upgradePct}
              title={upgradeTitle}
              value={formatFiatCompact(upgrade)}
              align="flex-end"
            />
          ) : null}
        </Stack>
      </YStack>
    </YStack>
  );
}
