import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  IconButton,
  SizableText,
  XStack,
  YStack,
  rootNavigationRef,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { ONEKEY_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import useAppNavigation from './useAppNavigation';
import { useLoginOneKeyId } from './useLoginOneKeyId';

// use rootNavigationRef to navigate
export function useToReferFriendsModalByRootNavigation() {
  return useCallback(async () => {
    const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();

    const screen = isLogin
      ? EModalReferFriendsRoutes.InviteReward
      : EModalReferFriendsRoutes.ReferAFriend;

    rootNavigationRef.current?.navigate(ERootRoutes.Modal, {
      screen: EModalRoutes.ReferFriendsModal,
      params: {
        screen,
      },
    });
  }, []);
}

export const isOpenedReferFriendsPage = () => {
  const routeState = rootNavigationRef.current?.getRootState();
  if (routeState?.routes) {
    return routeState.routes.find(
      // @ts-expect-error
      (route) => route.params?.screen === EModalRoutes.ReferFriendsModal,
    );
  }
  return false;
};

export const useReferFriends = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { loginOneKeyId } = useLoginOneKeyId();

  const toInviteRewardPage = useCallback(async () => {
    const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();
    if (isLogin) {
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.InviteReward,
      });
    } else {
      void loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: true });
    }
  }, [loginOneKeyId, navigation]);

  const toReferFriendsPage = useCallback(async () => {
    const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();
    const isVisited = await backgroundApiProxy.serviceSpotlight.isVisited(
      ESpotlightTour.referAFriend,
    );
    if (isLogin && isVisited) {
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.InviteReward,
      });
    } else {
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.ReferAFriend,
      });
    }
  }, [navigation]);

  const { copyText } = useClipboard();

  const shareReferRewards = useCallback(
    async (onSuccess?: () => void, onFail?: () => void) => {
      const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();
      const myReferralCode =
        await backgroundApiProxy.serviceReferralCode.getMyReferralCode();

      const postConfig =
        await backgroundApiProxy.serviceReferralCode.getPostConfig();

      const handleConfirm = () => {
        if (isLogin) {
          navigation.pushModal(EModalRoutes.ReferFriendsModal, {
            screen: EModalReferFriendsRoutes.InviteReward,
          });
        } else {
          void loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: true });
        }
      };
      const dialog = Dialog.show({
        icon: 'GiftOutline',
        title: intl.formatMessage({ id: ETranslations.earn_referral_title }),
        description: (
          <HyperlinkText
            size="$bodyMd"
            translationId={ETranslations.earn_referral_subtitle}
            underlineTextProps={{ color: '$textInfo' }}
            onAction={() => {
              void dialog.close();
            }}
          />
        ),
        renderContent: isLogin ? (
          <YStack gap="$5">
            <YStack gap="$1">
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({ id: ETranslations.referral_your_code })}
              </SizableText>
              <XStack gap="$3" ai="center">
                <SizableText size="$headingXl">{myReferralCode}</SizableText>
                <IconButton
                  title={intl.formatMessage({ id: ETranslations.global_copy })}
                  variant="tertiary"
                  icon="Copy3Outline"
                  size="small"
                  iconColor="$iconSubdued"
                  onPress={() => {
                    copyText(myReferralCode);
                    defaultLogger.referral.page.copyReferralCode();
                  }}
                />
              </XStack>
            </YStack>
          </YStack>
        ) : (
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
                      id: ETranslations.earn_referral_for_you_reward,
                    },
                    {
                      RebateRate: (
                        <SizableText size="$bodyMd" color="$textSuccess">
                          {`${postConfig?.commissionRate.amount || ''}${
                            postConfig?.commissionRate.unit || ''
                          }`}
                        </SizableText>
                      ),
                    },
                  )}
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
                      id: ETranslations.earn_referral_for_your_friend_reward,
                    },
                    {
                      number: `${postConfig?.friendDiscount.unit || ''}${
                        postConfig?.friendDiscount.amount || ''
                      }`,
                    },
                  )}
                </SizableText>
              </YStack>
            </XStack>
          </YStack>
        ),
        onCancelText: intl.formatMessage({
          id: ETranslations.referral_intro_learn_more,
        }),
        onCancel: () => {
          openUrlExternal(ONEKEY_URL);
        },
        cancelButtonProps: {
          iconAfter: 'OpenOutline',
        },
        onConfirmText: intl.formatMessage({
          id: isLogin
            ? ETranslations.earn_referral_view_rewards
            : ETranslations.global_join,
        }),
        onConfirm: handleConfirm,
      });
    },
    [copyText, intl, loginOneKeyId, navigation],
  );

  return useMemo(
    () => ({
      toReferFriendsPage,
      shareReferRewards,
      toInviteRewardPage,
    }),
    [toReferFriendsPage, shareReferRewards, toInviteRewardPage],
  );
};
