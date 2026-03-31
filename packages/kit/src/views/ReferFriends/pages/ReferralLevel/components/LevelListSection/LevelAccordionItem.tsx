import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Accordion,
  Badge,
  Icon,
  Image,
  Popover,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { sortCommissionRateItems } from '@onekeyhq/kit/src/views/ReferFriends/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IInviteLevelCommissionRate,
  IInviteLevelDetail,
  IInviteLevelUpgradeCondition,
} from '@onekeyhq/shared/src/referralCode/type';

import { CommissionRateCard } from './CommissionRateCard';

export function LevelAccordionItem({
  level,
  isCurrent,
  isLast,
  isHighestLevel,
  isLowestLevel,
  retentionConditions,
}: {
  level: IInviteLevelDetail['levels'][0];
  isCurrent: boolean;
  isFirst: boolean;
  isLast: boolean;
  isHighestLevel: boolean;
  isLowestLevel: boolean;
  retentionConditions?: IInviteLevelUpgradeCondition[];
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const currencyInfo = useCurrency();
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
  const getDefaultSubjectLabel = (subject?: string) => subject ?? '';
  const getDisplayLabel = (labelKey?: string, fallback?: string): string => {
    if (labelKey) {
      return intl.formatMessage({
        id: labelKey as any,
        defaultMessage: fallback,
      });
    }
    return fallback ?? '';
  };
  const retentionLabel = intl.formatMessage({
    id: ETranslations.referral_level_maintenance_conditions,
  });
  const retentionTooltip = intl.formatMessage({
    id: ETranslations.referral_referral_level_desc2,
  });
  const retentionBadge = (
    <Badge badgeSize="sm" badgeType="success">
      {retentionLabel}
    </Badge>
  );

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
                <Image w="$6" h="$6" src={level.icon} />
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
            <Stack animation="quick" rotate={open ? '180deg' : '0deg'}>
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
          <YStack gap="$3">
            {!isHighestLevel && level.upgradeConditions.length > 0 ? (
              <YStack gap="$2">
                {level.upgradeConditions.map((condition, index) => (
                  <XStack
                    key={`upgrade-${index}`}
                    jc="space-between"
                    ai="center"
                    flexWrap="wrap"
                    gap="$1"
                  >
                    <XStack gap="$2" ai="center">
                      <SizableText size="$bodyMd" color="$textSubdued">
                        {getDisplayLabel(
                          condition.levelUpLabelKey,
                          condition.levelUpLabel ??
                            condition.label ??
                            getDefaultSubjectLabel(condition.subject),
                        )}
                      </SizableText>
                      <Badge badgeSize="sm" badgeType="info">
                        {intl.formatMessage({
                          id: ETranslations.referral_level_upgrade_conditions,
                        })}
                      </Badge>
                    </XStack>
                    <XStack gap="$1" ai="center" jc="flex-end">
                      <SizableText size="$bodyMdMedium" color="$text">
                        {`${condition.currentFiatValue} / ≥ ${condition.thresholdFiatValue}`}
                      </SizableText>
                      <SizableText size="$bodyMd" color="$textSubdued">
                        {currencyInfo.id.toUpperCase()}
                      </SizableText>
                    </XStack>
                  </XStack>
                ))}
              </YStack>
            ) : null}

            {!isLowestLevel &&
            retentionConditions &&
            retentionConditions.length > 0 ? (
              <YStack gap="$2">
                {retentionConditions.map((condition, index) => (
                  <XStack
                    key={`retention-${index}`}
                    jc="space-between"
                    ai="center"
                    flexWrap="wrap"
                    gap="$1"
                  >
                    <XStack gap="$2" ai="center">
                      <SizableText size="$bodyMd" color="$textSubdued">
                        {getDisplayLabel(
                          condition.levelUpLabelKey,
                          condition.levelUpLabel ??
                            condition.label ??
                            getDefaultSubjectLabel(condition.subject),
                        )}
                      </SizableText>
                      {gtMd ? (
                        <Tooltip
                          renderTrigger={retentionBadge}
                          renderContent={retentionTooltip}
                        />
                      ) : (
                        <Popover
                          placement="top"
                          title={retentionLabel}
                          renderTrigger={retentionBadge}
                          renderContent={
                            <YStack px="$5" py="$4">
                              <SizableText size="$bodyMd">
                                {retentionTooltip}
                              </SizableText>
                            </YStack>
                          }
                        />
                      )}
                    </XStack>
                    <XStack gap="$1" ai="center" jc="flex-end">
                      <SizableText size="$bodyMdMedium" color="$text">
                        {`${condition.currentFiatValue} / ≥ ${condition.thresholdFiatValue}`}
                      </SizableText>
                      <SizableText size="$bodyMd" color="$textSubdued">
                        {currencyInfo.id.toUpperCase()}
                      </SizableText>
                    </XStack>
                  </XStack>
                ))}
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
                    rate.commissionRatesLabelKey || rate.labelKey,
                    rate.commissionRatesLabel ??
                      rate.label ??
                      getDefaultSubjectLabel(subject),
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
