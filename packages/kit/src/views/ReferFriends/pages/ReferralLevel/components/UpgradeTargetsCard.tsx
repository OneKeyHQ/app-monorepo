import { Fragment } from 'react';

import { useIntl } from 'react-intl';

import {
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteLevelItem } from '@onekeyhq/shared/src/referralCode/type';

import { LEVEL_COPY } from '../levelCopy';

import { getDisplayLabel } from './LevelListSection/LevelAccordionItem';
import { OrDivider } from './LevelListSection/OrDivider';
import { formatFiatExact } from './LevelListSection/SubjectMilestoneCard';

import type { ILevelTarget } from '../getLevelOverview';

function formatPct(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

function TargetColumn({
  target,
  currencyCode,
}: {
  target: ILevelTarget;
  currencyCode: string;
}) {
  const intl = useIntl();
  const { condition } = target;
  const label = getDisplayLabel(
    intl,
    condition.levelUpLabelKey,
    condition.levelUpLabel ?? condition.label ?? condition.subject,
  );
  const withCode = (value: string) => `${value} ${currencyCode}`;

  return (
    <YStack flex={1} gap="$2" minWidth={0}>
      <SizableText size="$bodyLgMedium">{label}</SizableText>
      <XStack ai="baseline" gap="$1.5">
        <SizableText size="$heading3xl" numberOfLines={1} flexShrink={1}>
          {formatFiatExact(target.current)}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued">
          {currencyCode}
        </SizableText>
      </XStack>
      <XStack ai="center" gap="$3">
        <Stack flex={1} h={6} borderRadius="$full" bg="$neutral5">
          <Stack
            h={6}
            borderRadius="$full"
            bg="$iconSuccess"
            width={`${target.progressPct}%`}
          />
        </Stack>
        <SizableText size="$bodySm" color="$textSubdued">
          {formatPct(target.progressPct)}
        </SizableText>
      </XStack>
      <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
        {LEVEL_COPY.target(withCode(formatFiatExact(target.target)))}
      </SizableText>
      {target.isReached ? (
        <SizableText size="$bodyMdMedium" color="$textSuccess">
          {LEVEL_COPY.targetReached}
        </SizableText>
      ) : (
        <SizableText size="$bodyLgMedium">
          {LEVEL_COPY.toGo(withCode(formatFiatExact(target.remaining)))}
        </SizableText>
      )}
    </YStack>
  );
}

export function UpgradeTargetsCard({
  nextLevel,
  targets,
}: {
  nextLevel: IInviteLevelItem;
  targets: ILevelTarget[];
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const currencyCode = currencyInfo.id.toUpperCase();

  return (
    <YStack
      gap="$4"
      p="$4"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
    >
      <XStack ai="center" jc="space-between" gap="$3" flexWrap="wrap">
        <XStack ai="center" gap="$2">
          {nextLevel.icon ? (
            <Image w="$8" h="$8" src={nextLevel.icon} />
          ) : (
            <SizableText size="$headingXl">{nextLevel.emoji}</SizableText>
          )}
          <SizableText size="$headingLg">
            {LEVEL_COPY.upgradeTo(nextLevel.label)}
          </SizableText>
        </XStack>
        {targets.length > 1 ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage(
              { id: ETranslations.referral_level_complete_any_n_of_m },
              { total: targets.length },
            )}
          </SizableText>
        ) : null}
      </XStack>
      <XStack gap="$4" ai="stretch" $md={{ flexDirection: 'column' }}>
        {targets.map((target, index) => (
          <Fragment key={target.subject}>
            <TargetColumn target={target} currencyCode={currencyCode} />
            {index < targets.length - 1 ? <OrDivider /> : null}
          </Fragment>
        ))}
      </XStack>
    </YStack>
  );
}
