import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { REFERRAL_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IReferAFriendIntroPhaseProps } from '../types';

export function ReferAFriendIntroPhase({
  postConfig,
}: IReferAFriendIntroPhaseProps) {
  const intl = useIntl();

  return (
    <YStack
      p="$5"
      gap="$5"
      animation="quick"
      enterStyle={{
        opacity: 1,
      }}
      exitStyle={{
        opacity: 0,
      }}
    >
      <SizableText size="$heading2xl">
        {intl.formatMessage(
          {
            id: ETranslations.referral_intro_title,
          },
          {
            RewardAmount: (
              <SizableText size="$heading2xl" color="$textSuccess">
                {`${postConfig.referralReward.unit}${postConfig.referralReward.amount}`}
              </SizableText>
            ),
          },
        )}
      </SizableText>
      <YStack gap="$5">
        <XStack gap="$4">
          <XStack h={42} w={42} p={9} borderRadius={13} bg="$bgSuccess">
            <Icon name="PeopleOutline" color="$iconSuccess" size={20} />
          </XStack>
          <YStack flexShrink={1}>
            <SizableText size="$headingMd">
              {intl.formatMessage({
                id: ETranslations.referral_intro_for_you,
              })}
            </SizableText>
            <SizableText mt="$1" size="$bodyMd" color="$textSubdued">
              {intl.formatMessage(
                {
                  id: ETranslations.referral_intro_for_you_1,
                },
                {
                  RebateRate: (
                    <SizableText size="$bodyMd" color="$textSuccess">
                      {`${postConfig.commissionRate.amount}${postConfig.commissionRate.unit}`}
                    </SizableText>
                  ),
                },
              )}
            </SizableText>
            <SizableText mt="$1" size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.referral_intro_for_you_2,
              })}
            </SizableText>
          </YStack>
        </XStack>
        <XStack gap="$4">
          <XStack h={42} w={42} p={9} borderRadius={13} bg="$bgInfo">
            <Icon name="PeopleLikeOutline" color="$iconInfo" size={20} />
          </XStack>
          <YStack flexShrink={1}>
            <SizableText size="$headingMd">
              {intl.formatMessage({
                id: ETranslations.referral_intro_for_your_friend,
              })}
            </SizableText>
            <SizableText mt="$1" size="$bodyMd" color="$textSubdued">
              {intl.formatMessage(
                {
                  id: ETranslations.referral_intro_for_your_friend_1,
                },
                {
                  RebateAmount: (
                    <SizableText size="$bodyMd" color="$textInfo">
                      {`${postConfig.friendDiscount.unit}${postConfig.friendDiscount.amount}`}
                    </SizableText>
                  ),
                },
              )}
            </SizableText>
            <SizableText mt="$1" size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.referral_intro_for_your_friend_2,
              })}
            </SizableText>
            <SizableText
              size="$bodyMd"
              color="$textInfo"
              pt="$2"
              textDecorationLine="underline"
              cursor="pointer"
              onPress={() => {
                openUrlExternal(REFERRAL_HELP_LINK);
              }}
            >
              {intl.formatMessage({
                id: ETranslations.referral_intro_learn_more,
              })}
            </SizableText>
          </YStack>
        </XStack>
      </YStack>
      <YStack />
    </YStack>
  );
}
