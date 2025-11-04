import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Accordion,
  Badge,
  Divider,
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
}: {
  level: IInviteLevelDetail['levels'][0];
  isCurrent: boolean;
}) {
  const intl = useIntl();
  const commissionRateItems = useMemo(() => {
    const rates = level.commissionRates;
    if (!rates) {
      return [] as { subject: string; rate: IInviteLevelCommissionRate }[];
    }
    if (Array.isArray(rates)) {
      return rates.map((rate, index) => ({
        subject: rate.subject ?? rate.labelKey ?? `${index}`,
        rate,
      }));
    }
    return Object.entries(rates).map(([subject, rate]) => ({
      subject,

      rate: { ...rate, subject: rate.subject ?? subject },
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

  return (
    <Accordion.Item value={`level-${level.level}`}>
      <Accordion.Trigger
        borderWidth={isCurrent ? 2 : 1}
        borderColor={isCurrent ? '$borderActive' : '$borderSubdued'}
        bg={isCurrent ? '$bgActive' : '$bg'}
      >
        {({ open }: { open: boolean }) => (
          <XStack flex={1} ai="center" jc="space-between">
            <XStack flex={1} gap="$3" ai="center">
              <Stack borderRadius="$2" w="$10" h="$10" ai="center" jc="center">
                <Image w="$10" h="$10" src={level.icon} />
              </Stack>
              <XStack gap="$2" ai="center">
                <SizableText size="$headingLg">{level.label}</SizableText>
                {isCurrent ? (
                  <Badge badgeType="success" badgeSize="sm">
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
          unstyled
          p="$4"
          borderWidth={isCurrent ? 2 : 1}
          borderTopWidth={0}
          borderColor={isCurrent ? '$borderActive' : '$borderSubdued'}
          bg={isCurrent ? '$bgActive' : '$bg'}
        >
          <YStack gap="$3">
            <YStack gap="$2">
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id: ETranslations.referral_rate,
                })}
              </SizableText>

              <YStack gap="$3">
                {commissionRateItems.map(({ subject, rate }, index) => {
                  const normalizedSubject = rate.subject ?? subject;
                  const label = getDisplayLabel(
                    rate.commissionRatesLabelKey || rate.labelKey,
                    rate.commissionRatesLabel ??
                      rate.label ??
                      getDefaultSubjectLabel(normalizedSubject),
                  );
                  const rebateLabel = getDisplayLabel(
                    rate.rebateLabelKey,
                    rate.rebateLabel ?? 'Rebate',
                  );
                  const discountLabel = getDisplayLabel(
                    rate.discountLabelKey,
                    rate.discountLabel ?? 'Discount',
                  );
                  return (
                    <YStack key={normalizedSubject || `${index}`} gap="$1.5">
                      <SizableText size="$bodyMd">{label}</SizableText>
                      <SizableText size="$bodyMd" color="$textSubdued">
                        {rebateLabel}:{' '}
                        <SizableText size="$bodyMdMedium" color="$textSuccess">
                          {rate.rebate}%
                        </SizableText>
                      </SizableText>
                      <SizableText size="$bodyMd" color="$textSubdued">
                        {discountLabel}:{' '}
                        <SizableText size="$bodyMdMedium" color="$textSuccess">
                          {rate.discount}%
                        </SizableText>
                      </SizableText>
                    </YStack>
                  );
                })}
              </YStack>
            </YStack>

            {level.upgradeConditions.length > 0 ? (
              <>
                <Divider />
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
                      <Currency size="$bodyMd" formatter="value">
                        {condition.thresholdFiatValue}
                      </Currency>
                    </XStack>
                  ))}
                </YStack>
              </>
            ) : null}
          </YStack>
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
}
