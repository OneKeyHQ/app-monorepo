import { Fragment, useMemo } from 'react';

import { type IntlShape, useIntl } from 'react-intl';

import {
  Accordion,
  Badge,
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { sortCommissionRateItems } from '@onekeyhq/kit/src/views/ReferFriends/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IInviteLevelCommissionRate,
  IInviteLevelDetail,
  IInviteLevelUpgradeCondition,
} from '@onekeyhq/shared/src/referralCode/type';

import { CommissionRateCard } from './CommissionRateCard';
import { OrDivider } from './OrDivider';
import { SubjectMilestoneCard } from './SubjectMilestoneCard';

function getDisplayLabel(
  intl: IntlShape,
  labelKey?: string,
  fallback?: string,
): string {
  if (labelKey) {
    return intl.formatMessage({
      id: labelKey as ETranslations,
      defaultMessage: fallback,
    });
  }
  return fallback ?? '';
}

export function LevelAccordionItem({
  level,
  isCurrent,
  isLast,
  isHighestLevel,
  isLowestLevel,
  retentionConditions,
  nextLevelLabel,
}: {
  level: IInviteLevelDetail['levels'][0];
  isCurrent: boolean;
  isLast: boolean;
  isHighestLevel: boolean;
  isLowestLevel: boolean;
  retentionConditions?: IInviteLevelUpgradeCondition[];
  nextLevelLabel?: string;
}) {
  const intl = useIntl();
  const commissionRateItems = useMemo(() => {
    const rates = level.commissionRates;
    if (!rates) {
      return [] as { subject: string; rate: IInviteLevelCommissionRate }[];
    }
    let items: { subject: string; rate: IInviteLevelCommissionRate }[];
    if (Array.isArray(rates)) {
      items = rates.map((rate, index) => ({
        subject: rate.labelKey ?? `${index}`,
        rate,
      }));
    } else {
      items = Object.entries(rates).map(([subject, rate]) => ({
        subject,
        rate,
      }));
    }
    return sortCommissionRateItems(items);
  }, [level.commissionRates]);

  const subjectGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        upgrade?: IInviteLevelUpgradeCondition;
        retention?: IInviteLevelUpgradeCondition;
      }
    >();
    if (!isHighestLevel) {
      for (const condition of level.upgradeConditions) {
        map.set(condition.subject, {
          ...map.get(condition.subject),
          upgrade: condition,
        });
      }
    }
    if (!isLowestLevel && retentionConditions) {
      for (const condition of retentionConditions) {
        map.set(condition.subject, {
          ...map.get(condition.subject),
          retention: condition,
        });
      }
    }
    const items = Array.from(map.entries()).map(([subject, milestones]) => {
      const reference = milestones.upgrade ?? milestones.retention;
      const subjectLabel = getDisplayLabel(
        intl,
        reference?.levelUpLabelKey,
        reference?.levelUpLabel ?? reference?.label ?? subject,
      );
      return { subject, milestones, subjectLabel };
    });
    return sortCommissionRateItems(items);
  }, [
    intl,
    level.upgradeConditions,
    retentionConditions,
    isHighestLevel,
    isLowestLevel,
  ]);

  const isMultiSubject = subjectGroups.length > 1;
  let headerNode: React.ReactNode = null;
  if (isMultiSubject) {
    headerNode = (
      <YStack gap="$0.5">
        <SizableText size="$bodyMdMedium" color="$text">
          {intl.formatMessage(
            { id: ETranslations.referral_level_complete_any_n_of_m },
            { total: subjectGroups.length },
          )}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.referral_level_complete_any_subtitle,
          })}
        </SizableText>
      </YStack>
    );
  } else if (subjectGroups.length === 1) {
    const only = subjectGroups[0];
    const titleId =
      only.milestones.retention && !only.milestones.upgrade
        ? ETranslations.referral_level_maintenance_conditions
        : ETranslations.referral_level_upgrade_conditions;
    headerNode = (
      <SizableText size="$bodyMdMedium" color="$text">
        {intl.formatMessage({ id: titleId })}
      </SizableText>
    );
  }

  return (
    <Accordion.Item value={`level-${level.level}`}>
      <Accordion.Trigger borderWidth={0} p={0}>
        {({ open }: { open: boolean }) => (
          <XStack
            flex={1}
            ai="center"
            jc="space-between"
            py="$2.5"
            px="$4"
            borderColor="$borderSubdued"
            borderBottomWidth={isLast && !open ? 0 : 1}
            borderTopWidth={0}
            borderRightWidth={0}
            borderLeftWidth={0}
          >
            <XStack flex={1} gap="$3" ai="center">
              <Stack borderRadius="$2" w="$6" h="$6" ai="center" jc="center">
                {level.icon ? (
                  <Image w="$6" h="$6" src={level.icon} />
                ) : (
                  <SizableText size="$bodyLg">{level.emoji ?? ''}</SizableText>
                )}
              </Stack>
              <XStack gap="$2" ai="center">
                <SizableText size="$headingLg">{level.label}</SizableText>
                {isCurrent ? (
                  <Badge badgeSize="sm">
                    {intl.formatMessage({
                      id: ETranslations.referral_current_level,
                    })}
                  </Badge>
                ) : null}
              </XStack>
            </XStack>
            <Stack
              animation="quick"
              animateOnly={ANIMATE_ONLY_TRANSFORM}
              rotate={open ? '180deg' : '0deg'}
            >
              <Icon
                name="ChevronDownSmallOutline"
                color={open ? '$iconActive' : '$iconSubdued'}
                size="$5"
              />
            </Stack>
          </XStack>
        )}
      </Accordion.Trigger>
      <Accordion.HeightAnimator animation="quick">
        <Accordion.Content
          borderBottomWidth={isLast ? 0 : 1}
          borderTopWidth={0}
          borderRightWidth={0}
          borderLeftWidth={0}
          unstyled
          borderBottomColor="$borderSubdued"
          p="$4"
          bg="$bgSubdued"
        >
          <YStack gap="$4">
            {subjectGroups.length > 0 ? (
              <YStack gap="$3">
                {headerNode}
                <XStack gap="$2" ai="stretch" $md={{ flexDirection: 'column' }}>
                  {subjectGroups.map(
                    ({ subject, milestones, subjectLabel }, index) => (
                      <Fragment key={subject}>
                        <SubjectMilestoneCard
                          subjectLabel={subjectLabel}
                          milestones={milestones}
                          nextLevelLabel={nextLevelLabel}
                          optionIndex={isMultiSubject ? index + 1 : undefined}
                        />
                        {index < subjectGroups.length - 1 ? (
                          <OrDivider />
                        ) : null}
                      </Fragment>
                    ),
                  )}
                </XStack>
              </YStack>
            ) : null}

            <YStack gap="$2">
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id: ETranslations.referral_rate,
                })}
              </SizableText>

              <XStack gap="$3" $md={{ flexDirection: 'column', gap: '$2' }}>
                {commissionRateItems.map(({ subject, rate }, index) => {
                  const label = getDisplayLabel(
                    intl,
                    rate.commissionRatesLabelKey || rate.labelKey,
                    rate.commissionRatesLabel ?? rate.label ?? subject,
                  );
                  return (
                    <CommissionRateCard
                      key={subject || `${index}`}
                      label={label}
                      rate={rate}
                    />
                  );
                })}
              </XStack>
            </YStack>
          </YStack>
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
}
