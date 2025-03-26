import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Icon,
  Image,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { ETranslations } from '@onekeyhq/shared/src/locale';

enum EPhaseState {
  next = 'next',
  join = 'join',
}

function Line({ no, description }: { no: number; description: string }) {
  return (
    <XStack gap="$3">
      <XStack
        bg="$bgInfo"
        w={28}
        h={28}
        p="$2"
        gap="$2"
        ai="center"
        jc="center"
        borderRadius="$full"
      >
        <SizableText size="$bodySmMedium" color="$textInfo">
          {no}
        </SizableText>
      </XStack>
      <SizableText size="$bodyLg">{description}</SizableText>
    </XStack>
  );
}

export default function ReferAFriend() {
  const intl = useIntl();
  const [phaseState, setPhaseState] = useState(EPhaseState.next);
  const navigation = useAppNavigation();
  const { toInviteRewardPage } = useReferFriends();
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.id_refer_a_friend,
        })}
      />
      <Page.Body>
        <YStack>
          <Image
            h={224}
            source={require('@onekeyhq/kit/assets/refer_banner.jpg')}
          />
          <AnimatePresence>
            {phaseState === EPhaseState.next ? (
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
                          $27
                        </SizableText>
                      ),
                    },
                  )}
                </SizableText>
                <YStack gap="$5">
                  <XStack gap="$4">
                    <XStack
                      h={42}
                      w={42}
                      p={9}
                      borderRadius={13}
                      bg="$bgSuccess"
                    >
                      <Icon
                        name="PeopleOutline"
                        color="$iconSuccess"
                        size={20}
                      />
                    </XStack>
                    <YStack>
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
                                5-18%
                              </SizableText>
                            ),
                          },
                        )}
                      </SizableText>
                      <SizableText
                        size="$bodyMd"
                        color="$textSubdued"
                        pt="$0.5"
                      >
                        {intl.formatMessage({
                          id: ETranslations.earn_referral_for_you_reward,
                        })}
                      </SizableText>
                    </YStack>
                  </XStack>
                  <XStack gap="$4">
                    <XStack h={42} w={42} p={9} borderRadius={13} bg="$bgInfo">
                      <Icon
                        name="PeopleLikeOutline"
                        color="$iconInfo"
                        size={20}
                      />
                    </XStack>
                    <YStack>
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
                            RebateRate: (
                              <SizableText size="$bodyMd" color="$textInfo">
                                5%
                              </SizableText>
                            ),
                          },
                        )}
                      </SizableText>
                      <SizableText
                        size="$bodyMd"
                        color="$textSubdued"
                        pt="$0.5"
                      >
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
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_learn_more,
                        })}
                      </SizableText>
                    </YStack>
                  </XStack>
                </YStack>
                <YStack />
              </YStack>
            ) : null}
          </AnimatePresence>
          <AnimatePresence>
            {phaseState === EPhaseState.join ? (
              <YStack
                p="$5"
                gap="$5"
                animation="quick"
                enterStyle={{
                  opacity: 0,
                }}
                exitStyle={{
                  opacity: 0,
                }}
              >
                <SizableText size="$heading2xl" textAlign="center">
                  {intl.formatMessage({
                    id: ETranslations.referral_intro_title_2,
                  })}
                </SizableText>
                <YStack gap="$5">
                  <Line
                    no={1}
                    description={intl.formatMessage({
                      id: ETranslations.referral_how_1,
                    })}
                  />
                  <Line
                    no={2}
                    description={intl.formatMessage({
                      id: ETranslations.referral_how_2,
                    })}
                  />
                  <Line
                    no={3}
                    description={intl.formatMessage({
                      id: ETranslations.referral_how_3,
                    })}
                  />
                  <Line
                    no={4}
                    description={intl.formatMessage({
                      id: ETranslations.referral_how_4,
                    })}
                  />
                </YStack>
                <YStack />
              </YStack>
            ) : null}
          </AnimatePresence>
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id:
            phaseState === EPhaseState.next
              ? ETranslations.global_next
              : ETranslations.global_join,
        })}
        onConfirm={async () => {
          if (phaseState === EPhaseState.next) {
            setPhaseState(EPhaseState.join);
            return;
          }
          navigation.popStack();
          setTimeout(() => {
            void toInviteRewardPage();
          }, 200);
        }}
      />
    </Page>
  );
}
