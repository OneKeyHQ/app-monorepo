import { useIntl } from 'react-intl';

import {
  Image,
  Progress,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import type { IInviteLevelItem } from '@onekeyhq/shared/src/referralCode/type';

import { LEVEL_COPY, LEVEL_TARGET_SHORT_LABELS } from '../levelCopy';

import { getDisplayLabel } from './LevelListSection/LevelAccordionItem';
import {
  formatFiatCompact,
  formatFiatExact,
} from './LevelListSection/SubjectMilestoneCard';

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

// Each target reads as its name, "current / target" and the bar, like the
// compact rows. A percentage or a "to go" line would only restate the
// figures, so the only extra line marks a target already reached.
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
      <Progress
        size="medium"
        value={target.progressPct}
        progressColor="$neutral4"
        indicatorColor="$iconSuccess"
      />
      {target.isReached ? (
        <SizableText size="$bodyMdMedium" color="$textSuccess">
          {LEVEL_COPY.targetReached}
        </SizableText>
      ) : null}
    </YStack>
  );
}

// Compact layouts list the targets as two-line rows: the name with
// "current / target" on the right, then a thin bar. The percentage, the
// "to go" line and the OR dividers would only repeat what the bar, the
// figures and the "meet any one" rule already say.
function TargetRow({
  target,
  currencySymbol,
}: {
  target: ILevelTarget;
  currencySymbol: string;
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
            {/* Written like the level table below: the currency symbol, the
                exact progress, and the target in short form. */}
            <SizableText size="$bodyMdMedium">
              {`${currencySymbol}${formatFiatExact(target.current)}`}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {`/ ${currencySymbol}${formatFiatCompact(target.target)}`}
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
            currencySymbol={currencyInfo.symbol}
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
      {/* The "meet any one" rule above already says these are alternatives,
          so the columns are split by space, not OR dividers. */}
      <XStack gap="$10" ai="flex-start">
        {targets.map((target) => (
          <TargetColumn
            key={target.subject}
            target={target}
            currencyCode={currencyCode}
          />
        ))}
      </XStack>
    </YStack>
  );
}
