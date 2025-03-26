import { type PropsWithChildren, useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  ActionList,
  Badge,
  Icon,
  IconButton,
  LinearGradient,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

import { usePrimeAuthV2 } from '../../../Prime/hooks/usePrimeAuthV2';

function Tag({ children }: PropsWithChildren) {
  return (
    <XStack bg="$bgStrong" borderRadius="$1">
      <SizableText color="$textSubdued" size="$bodySmMedium" px="$2" py="$0.5">
        {children}
      </SizableText>
    </XStack>
  );
}

export default function OneKeyId() {
  const { isLoggedIn, user, logout } = usePrimeAuthV2();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const toInviteRewardPage = useCallback(() => {
    navigation.push(EModalReferFriendsRoutes.InviteReward);
  }, [navigation]);
  return (
    <Page scrollEnabled>
      <Page.Header title="OneKey ID" />
      <Page.Body>
        <YStack>
          <YStack p="$5" ai="center" jc="center">
            <LinearGradient
              bg="$bgInverse"
              borderRadius="$3"
              colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0)']}
              width={56}
              height={56}
              jc="center"
              ai="center"
            >
              <Icon size="$8" name="PeopleSolid" color="$iconInverse" />
            </LinearGradient>
            <SizableText pt="$5" pb="$2" size="$heading2xl">
              OneKey ID
            </SizableText>
            <SizableText color="$textSubdued" size="$bodyLg">
              {intl.formatMessage({ id: ETranslations.id_desc })}
            </SizableText>
            <SizableText color="$textSubdued" size="$bodyLg">
              {intl.formatMessage({
                id: ETranslations.earn_referral_referral_reward,
              })}
            </SizableText>
          </YStack>
          <XStack
            m="$5"
            p="$4"
            borderRadius="$3"
            jc="space-between"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            shadowColor="rgba(0, 0, 0, 0.09)"
            shadowOffset={{ width: 0, height: 1 }}
            shadowOpacity={1}
            shadowRadius={2}
            elevation={0.5}
          >
            <XStack gap="$2">
              <Icon size="$5" name="PeopleOutline" color="$iconSubdued" />
              <SizableText size="$bodyMdMedium">{user.email}</SizableText>
            </XStack>
            <XStack gap="$2">
              <Tag>free</Tag>
              <ActionList
                title={intl.formatMessage({ id: ETranslations.global_more })}
                renderTrigger={
                  <IconButton
                    icon="DotHorOutline"
                    variant="tertiary"
                    size="small"
                  />
                }
                items={[
                  {
                    icon: 'LogoutOutline',
                    testID: 'logout-button',
                    onPress: () => {
                      navigation.pop();
                      void logout();
                    },
                    label: intl.formatMessage({
                      id: ETranslations.prime_log_out,
                    }),
                  },
                ]}
              />
            </XStack>
          </XStack>
          <YStack>
            <ListItem
              userSelect="none"
              renderAvatar={
                <XStack
                  borderRadius="$3"
                  bg="$brand7"
                  w="$12"
                  h="$12"
                  ai="center"
                  jc="center"
                >
                  <Icon name="PrimeSolid" color="$brand12" size="$6" />
                </XStack>
              }
              title="OneKey Prime"
              subtitle={intl.formatMessage({
                id: ETranslations.id_prime,
              })}
            >
              <Badge badgeSize="sm">
                <Badge.Text>
                  {intl.formatMessage({
                    id: ETranslations.id_prime_soon,
                  })}
                </Badge.Text>
              </Badge>
            </ListItem>
            <ListItem
              userSelect="none"
              renderAvatar={
                <XStack
                  borderRadius="$3"
                  bg="$purple8"
                  w="$12"
                  h="$12"
                  ai="center"
                  jc="center"
                >
                  <Icon name="GiftSolid" color="$purple12" size="$6" />
                </XStack>
              }
              title={intl.formatMessage({
                id: ETranslations.id_refer_a_friend,
              })}
              subtitle={intl.formatMessage({
                id: ETranslations.id_refer_a_friend_desc,
              })}
              onPress={toInviteRewardPage}
            >
              <IconButton
                icon="ChevronRightSmallOutline"
                variant="tertiary"
                size="small"
              />
            </ListItem>
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}
