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
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

export function LevelAccordionItem({
  level,
  isCurrent,
}: {
  level: IInviteLevelDetail['levels'][0];
  isCurrent: boolean;
}) {
  const intl = useIntl();
  const hardwareSalesRate = level.commissionRates.HardwareSales;
  const onchainRate = level.commissionRates.Onchain;

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

              <XStack gap="$4">
                {hardwareSalesRate ? (
                  <YStack gap="$1.5" flex={1}>
                    <XStack gap="$2" ai="center">
                      <Icon name="OnekeyLiteOutline" size="$5" />
                      <SizableText size="$bodyMd">Hardware sales</SizableText>
                    </XStack>
                    <SizableText size="$bodyMd" color="$textSubdued">
                      Rebate: <SizableText size="$bodyMdMedium" color="$textSuccess">{hardwareSalesRate.rebate}%</SizableText>
                    </SizableText>
                    <SizableText size="$bodyMd" color="$textSubdued">
                      Discount: <SizableText size="$bodyMdMedium" color="$textSuccess">{hardwareSalesRate.discount}%</SizableText>
                    </SizableText>
                  </YStack>
                ) : null}

                {onchainRate ? (
                  <YStack gap="$1.5" flex={1}>
                    <XStack gap="$2" ai="center">
                      <Icon name="CoinsOutline" size="$5" />
                      <SizableText size="$bodyMd">
                        DeFi performance fee
                      </SizableText>
                    </XStack>
                    <SizableText size="$bodyMd" color="$textSubdued">
                      Rebate: <SizableText size="$bodyMdMedium" color="$textSuccess">{onchainRate.rebate}%</SizableText>
                    </SizableText>
                    <SizableText size="$bodyMd" color="$textSubdued">
                      Discount: <SizableText size="$bodyMdMedium" color="$textSuccess">{onchainRate.discount}%</SizableText>
                    </SizableText>
                  </YStack>
                ) : null}
              </XStack>
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
                        {condition.subject === 'HardwareSales'
                          ? 'Hardware sales'
                          : 'DeFi performance fee'}
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
