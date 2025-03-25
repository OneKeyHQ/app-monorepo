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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

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
  return (
    <Page scrollEnabled>
      <Page.Header title="Refer a friend" />
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
                  Get up to{' '}
                  <SizableText size="$heading2xl" color="$textSuccess">
                    $27
                  </SizableText>{' '}
                  per Friend - Plus Lifetime Rewards
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
                      <SizableText size="$headingMd">For You</SizableText>
                      <SizableText mt="$1" size="$bodyMd" color="$textSubdued">
                        Get{' '}
                        <SizableText size="$bodyMd" color="$textSuccess">
                          5-18%
                        </SizableText>{' '}
                        hardware wallet sale commission.
                      </SizableText>
                      <SizableText
                        size="$bodyMd"
                        color="$textSubdued"
                        pt="$0.5"
                      >
                        Unlock lifetime rewards from your friends’ DeFi earnings
                        and more.
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
                        For Your Friend
                      </SizableText>
                      <SizableText mt="$1" size="$bodyMd" color="$textSubdued">
                        <SizableText size="$bodyMd" color="$textInfo">
                          5% off
                        </SizableText>{' '}
                        on hardware wallets at checkout with your code.
                      </SizableText>
                      <SizableText
                        size="$bodyMd"
                        color="$textSubdued"
                        pt="$0.5"
                      >
                        DeFi welcome bonus.
                      </SizableText>
                      <SizableText
                        size="$bodyMd"
                        color="$textInfo"
                        pt="$2"
                        textDecorationLine="underline"
                        cursor="pointer"
                      >
                        Learn more
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
                  How it works
                </SizableText>
                <YStack gap="$5">
                  <Line no={1} description="Create a OneKey ID" />
                  <Line
                    no={2}
                    description="Invite your friend by your referral code"
                  />
                  <Line
                    no={3}
                    description="Your friend place order or be using Earn"
                  />
                  <Line no={4} description="Your get Reward" />
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
          navigation.push(EModalReferFriendsRoutes.HardwareSalesReward);
        }}
      />
    </Page>
  );
}
