import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  EVideoResizeMode,
  Icon,
  Page,
  SizableText,
  Video,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { referralLink } from '@onekeyhq/shared/src/utils/referralUtils';

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
  const themeName = useThemeVariant();
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.id_refer_a_friend,
        })}
      />
      <Page.Body>
        <YStack>
          <Video
            height={224}
            repeat
            muted
            source={
              themeName === 'dark'
                ? require('@onekeyhq/kit/assets/OP-Dark.mp4')
                : require('@onekeyhq/kit/assets/OP-Light.mp4')
            }
            resizeMode={EVideoResizeMode.COVER}
            controls={false}
            playInBackground={false}
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
                        onPress={() => {
                          openUrlExternal(referralLink);
                        }}
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
          await backgroundApiProxy.serviceSpotlight.firstVisitTour(
            ESpotlightTour.referAFriend,
          );
          navigation.popStack();
          setTimeout(() => {
            void toInviteRewardPage();
          }, 200);
        }}
      />
    </Page>
  );
}
