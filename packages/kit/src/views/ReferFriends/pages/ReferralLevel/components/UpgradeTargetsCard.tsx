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
import { getDisplayLabel } from '@onekeyhq/kit/src/views/ReferFriends/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteLevelItem } from '@onekeyhq/shared/src/referralCode/type';

import { LEVEL_TARGET_LABEL_IDS } from '../levelCopy';

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
  const labelId = LEVEL_TARGET_LABEL_IDS[target.subject];
  if (labelId) {
    return intl.formatMessage({ id: labelId });
  }
  return getDisplayLabel(
    intl,
    condition.levelUpLabelKey,
    condition.levelUpLabel ?? condition.label ?? condition.subject,
  );
}

export function formatLevelTargetRemaining(
  intl: IntlShape,
  target: ILevelTarget,
  currencyCode: string,
) {
  return target.isReached
    ? intl.formatMessage({ id: ETranslations.referral_target_reached__msg })
    : intl.formatMessage(
        { id: ETranslations.referral_to_go__desc },
        { amount: `${formatFiatExact(target.remaining)} ${currencyCode}` },
      );
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
          {intl.formatMessage({
            id: ETranslations.referral_target_reached__msg,
          })}
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
      {/* A long target name wraps; the figures stay on one line. */}
      <XStack ai="flex-start" jc="space-between" gap="$3">
        <SizableText size="$bodyMdMedium" flex={1} flexBasis={0} minWidth={0}>
          {label}
        </SizableText>
        {target.isReached ? (
          <SizableText size="$bodyMdMedium" color="$textSuccess" flexShrink={0}>
            {intl.formatMessage({
              id: ETranslations.referral_target_reached__msg,
            })}
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
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const currencyCode = currencyInfo.id.toUpperCase();
  const { md } = useMedia();
  const upgradeTitle = intl.formatMessage(
    { id: ETranslations.referral_upgrade_to__title },
    { level: getDisplayLabel(intl, nextLevel.labelKey, nextLevel.label) },
  );
  const upgradeRule = intl.formatMessage({
    id:
      targets.length > 1
        ? ETranslations.referral_meet_any__desc
        : ETranslations.referral_meet_this__desc,
  });

  if (md) {
    return (
      <YStack gap="$4">
        <YStack gap="$0.5">
          <XStack ai="center" gap="$2">
            {nextLevel.icon ? (
              <Image w="$5" h="$5" src={nextLevel.icon} />
            ) : null}
            <SizableText size="$headingMd" numberOfLines={1} flexShrink={1}>
              {upgradeTitle}
            </SizableText>
          </XStack>
          <SizableText size="$bodyMd" color="$textSubdued">
            {upgradeRule}
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
        <SizableText size="$headingMd">{upgradeTitle}</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {`· ${upgradeRule}`}
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
