import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  IconButton,
  LinearGradient,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

import { PrimeUserInfo } from '../../../Prime/pages/PrimeDashboard/PrimeUserInfo';

export default function OneKeyId() {
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
          </YStack>
          <Stack p="$5">
            <PrimeUserInfo
              onLogoutSuccess={async () => {
                navigation.popStack();
              }}
            />
          </Stack>
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
