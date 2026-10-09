import { Fragment } from 'react';

import { useIntl } from 'react-intl';

import {
  Image,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import type { IInviteLevelItem } from '@onekeyhq/shared/src/referralCode/type';

import { LEVEL_COPY, LEVEL_TARGET_SHORT_LABELS } from '../levelCopy';

import { getDisplayLabel } from './LevelListSection/LevelAccordionItem';
import { OrDivider } from './LevelListSection/OrDivider';
import { formatFiatExact } from './LevelListSection/SubjectMilestoneCard';

import type { ILevelTarget } from '../getLevelOverview';
import type { IntlShape } from 'react-intl';

// Shared with the invite page's level popover so both name a target and its
// remaining amount the same way.
export function getLevelTargetLabel(intl: IntlShape, target: ILevelTarget) {
  const { condition } = target;
  return (
    LEVEL_TARGET_SHORT_LABELS[target.subject] ??
    getDisplayLabel(
      intl,
      condition.levelUpLabelKey,
      condition.levelUpLabel ?? condition.label ?? condition.subject,
    )
  );
}

export function formatLevelTargetRemaining(
  target: ILevelTarget,
  currencyCode: string,
) {
  return target.isReached
    ? LEVEL_COPY.targetReached
    : LEVEL_COPY.toGo(`${formatFiatExact(target.remaining)} ${currencyCode}`);
}

function formatPct(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

// Three lines per target: progress as "current / target", the bar, and what
// is left. The target is not repeated on its own line.
function TargetColumn({
  target,
  currencyCode,
}: {
  target: ILevelTarget;
  currencyCode: string;
}) {
  const intl = useIntl();
  const label = getLevelTargetLabel(intl, target);

  return (
    <YStack flex={1} flexBasis={0} gap="$2" minWidth={0}>
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <XStack ai="baseline" columnGap="$1.5" flexWrap="wrap">
        <SizableText size="$heading2xl">
          {formatFiatExact(target.current)}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued">
          {`/ ${formatFiatExact(target.target)} ${currencyCode}`}
        </SizableText>
      </XStack>
      <XStack ai="center" gap="$3">
        <Stack flex={1}>
          <Progress
            size="medium"
            value={target.progressPct}
            progressColor="$neutral4"
            indicatorColor="$iconSuccess"
          />
        </Stack>
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {formatPct(target.progressPct)}
        </SizableText>
      </XStack>
      <SizableText
        size="$bodyMdMedium"
        color={target.isReached ? '$textSuccess' : '$text'}
      >
        {formatLevelTargetRemaining(target, currencyCode)}
      </SizableText>
    </YStack>
  );
}

// Compact layouts list the targets as two-line rows: the name with
// "current / target" on the right, then a thin bar. The percentage, the
// "to go" line and the OR dividers would only repeat what the bar, the
// figures and the "meet any one" rule already say.
function TargetRow({
  target,
  currencyCode,
}: {
  target: ILevelTarget;
  currencyCode: string;
}) {
  const intl = useIntl();
  const label = getLevelTargetLabel(intl, target);

  return (
    <YStack gap="$2">
      <XStack ai="center" jc="space-between" gap="$3">
        <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
          {label}
        </SizableText>
        {target.isReached ? (
          <SizableText size="$bodyMdMedium" color="$textSuccess">
            {LEVEL_COPY.targetReached}
          </SizableText>
        ) : (
          <XStack ai="baseline" gap="$1" flexShrink={0}>
            <SizableText size="$bodyMdMedium">
              {formatFiatExact(target.current)}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {`/ ${formatFiatExact(target.target)} ${currencyCode}`}
            </SizableText>
          </XStack>
        )}
      </XStack>
      <Progress
        size="small"
        value={target.progressPct}
        progressColor="$neutral4"
        indicatorColor="$iconSuccess"
      />
    </YStack>
  );
}

export function UpgradeTargetsSection({
  nextLevel,
  targets,
}: {
  nextLevel: IInviteLevelItem;
  targets: ILevelTarget[];
}) {
  const currencyInfo = useCurrency();
  const currencyCode = currencyInfo.id.toUpperCase();
  const { md } = useMedia();

  if (md) {
    return (
      <YStack gap="$4">
        <YStack gap="$0.5">
          <XStack ai="center" gap="$2">
            {nextLevel.icon ? (
              <Image w="$5" h="$5" src={nextLevel.icon} />
            ) : null}
            <SizableText size="$headingMd" numberOfLines={1} flexShrink={1}>
              {LEVEL_COPY.upgradeTo(nextLevel.label)}
            </SizableText>
          </XStack>
          <SizableText size="$bodyMd" color="$textSubdued">
            {LEVEL_COPY.upgradeRule(targets.length > 1)}
          </SizableText>
        </YStack>
        {targets.map((target) => (
          <TargetRow
            key={target.subject}
            target={target}
            currencyCode={currencyCode}
          />
        ))}
      </YStack>
    );
  }

  return (
    <YStack gap="$5">
      <XStack ai="center" gap="$2" flexWrap="wrap">
        {nextLevel.icon ? <Image w="$5" h="$5" src={nextLevel.icon} /> : null}
        <SizableText size="$headingMd">
          {LEVEL_COPY.upgradeTo(nextLevel.label)}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {`· ${LEVEL_COPY.upgradeRule(targets.length > 1)}`}
        </SizableText>
      </XStack>
      <XStack gap="$5" ai="stretch">
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
