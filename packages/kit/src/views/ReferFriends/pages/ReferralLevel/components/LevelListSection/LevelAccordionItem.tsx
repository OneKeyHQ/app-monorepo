import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

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
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IInviteLevelCommissionRate,
  IInviteLevelDetail,
} from '@onekeyhq/shared/src/referralCode/type';

export function LevelAccordionItem({
  level,
  isCurrent,
  isFirst,
  isLast,
}: {
  level: IInviteLevelDetail['levels'][0];
  isCurrent: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const intl = useIntl();
  const commissionRateItems = useMemo(() => {
    const rates = level.commissionRates;
    if (!rates) {
      return [] as { subject: string; rate: IInviteLevelCommissionRate }[];
    }
    if (Array.isArray(rates)) {
      return rates.map((rate, index) => ({
        subject: rate.labelKey ?? `${index}`,
        rate,
      }));
    }
    return Object.entries(rates).map(([subject, rate]) => ({
      subject,
      rate,
    }));
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

  const getBorderTopWidth = () => {
    if (!isFirst) return 0;
    return 1;
  };

  return (
    <Accordion.Item value={`level-${level.level}`}>
      <Accordion.Trigger
        borderColor="$borderSubdued"
        borderLeftWidth={1}
        borderRightWidth={1}
        borderBottomWidth={1}
        borderTopWidth={getBorderTopWidth()}
        borderTopLeftRadius={isFirst ? '$3' : '$0'}
        borderTopRightRadius={isFirst ? '$3' : '$0'}
        borderBottomLeftRadius={isLast ? '$3' : '$0'}
        borderBottomRightRadius={isLast ? '$3' : '$0'}
      >
        {({ open }: { open: boolean }) => (
          <XStack flex={1} ai="center" jc="space-between" py="$1" px="$2">
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
          borderBottomWidth={1}
          unstyled
          borderRightColor="$borderSubdued"
          borderLeftColor="$borderSubdued"
          borderBottomColor="$borderSubdued"
          borderRightWidth={1}
          borderLeftWidth={1}
          p="$4"
          bg="$bgSubdued"
          borderTopWidth={0}
          borderBottomLeftRadius={isLast ? '$3' : '$0'}
          borderBottomRightRadius={isLast ? '$3' : '$0'}
        >
          <YStack gap="$3">
            {level.upgradeConditions.length > 0 ? (
              <>
                <YStack gap="$2">
                  <SizableText size="$bodyMdMedium">
                    {intl.formatMessage({
                      id: ETranslations.referral_upgrade_condition,
                    })}
                  </SizableText>
                  {level.upgradeConditions.map((condition, index) => (
                    <XStack key={index} jc="space-between" ai="center">
                      <SizableText size="$bodyMd" color="$textSubdued">
                        {getDisplayLabel(
                          condition.levelUpLabelKey,
                          condition.levelUpLabel ??
                            condition.label ??
                            getDefaultSubjectLabel(condition.subject),
                        )}
                      </SizableText>
                      <XStack gap="$1" ai="center" jc="flex-end">
                        <SizableText size="$bodyMdMedium" color="$text">
                          {`${condition.current} / ${condition.thresholdFiatValue}`}
                        </SizableText>
                        <SizableText size="$bodyMd" color="$textSubdued">
                          USD
                        </SizableText>
                      </XStack>
                    </XStack>
                  ))}
                </YStack>
              </>
            ) : null}

            <YStack gap="$2">
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id: ETranslations.referral_rate,
                })}
              </SizableText>

              <XStack gap="$3" $md={{ flexDirection: 'column' }}>
                {commissionRateItems.map(({ subject, rate }, index) => {
                  const label = getDisplayLabel(
                    rate.commissionRatesLabelKey || rate.labelKey,
                    rate.commissionRatesLabel ??
                      rate.label ??
                      getDefaultSubjectLabel(subject),
                  );
                  return (
                    <YStack
                      key={subject || `${index}`}
                      gap="$1.5"
                      flex={1}
                      borderRadius="$3"
                      borderWidth={StyleSheet.hairlineWidth}
                      borderColor="$neutral3"
                      px="$4"
                      py="$3"
                    >
                      <SizableText size="$headingSm" color="$text">
                        {label}
                      </SizableText>

                      <XStack
                        borderRadius="$2"
                        bg="$bgStrong"
                        py="$1"
                        px="$2"
                        jc="space-between"
                      >
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {intl.formatMessage({
                            id: ETranslations.referral_upgrade_you,
                          })}
                        </SizableText>

                        <SizableText size="$bodyMdMedium" color="$text">
                          {rate.rebate}%
                        </SizableText>
                      </XStack>

                      <XStack
                        borderRadius="$2"
                        bg="$bgStrong"
                        py="$1"
                        px="$2"
                        jc="space-between"
                      >
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {intl.formatMessage({
                            id: ETranslations.referral_upgrade_user,
                          })}
                        </SizableText>

                        <SizableText size="$bodyMdMedium" color="$text">
                          {rate.discount}%
                        </SizableText>
                      </XStack>
                    </YStack>
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
