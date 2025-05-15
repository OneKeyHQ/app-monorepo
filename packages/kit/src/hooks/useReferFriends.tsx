import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  IconButton,
  OTPInput,
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

const NUMBER_OF_DIGITS = 6;
function InviteCode({
  onSuccess,
  onFail,
}: {
  onSuccess?: () => void;
  onFail?: () => void;
}) {
  const intl = useIntl();
  const [verificationCode, setVerificationCode] = useState('');
  const handleConfirm = useCallback(async () => {
    try {
      await backgroundApiProxy.serviceReferralCode.bindInviteCode(
        verificationCode,
      );
      onSuccess?.();
    } catch {
      onFail?.();
    }
  }, [onFail, onSuccess, verificationCode]);
  return (
    <YStack>
      <OTPInput
        type="alphanumeric"
        autoFocus
        status="normal"
        numberOfDigits={NUMBER_OF_DIGITS}
        value={verificationCode}
        onTextChange={(value) => {
          setVerificationCode(value);
        }}
      />
      <SizableText mt="$3" size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.earn_referral_enter_invite_code_note,
        })}
      </SizableText>
      <Dialog.Footer
        showCancelButton={false}
        confirmButtonProps={{
          disabled: verificationCode.length !== NUMBER_OF_DIGITS,
        }}
        onConfirm={handleConfirm}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_confirm })}
      />
    </YStack>
  );
}

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
  const bindInviteCode = useCallback(
    (onSuccess?: () => void, onFail?: () => void) => {
      Dialog.confirm({
        showExitButton: false,
        icon: 'InputOutline',
        title: intl.formatMessage({
          id: ETranslations.earn_referral_enter_invite_code_title,
        }),
        description: intl.formatMessage(
          {
            id: ETranslations.earn_referral_enter_invite_code_subtitle,
          },
          {
            number: '3%',
          },
        ),
        renderContent: <InviteCode onSuccess={onSuccess} onFail={onFail} />,
      });
    },
    [intl],
  );

  const changeInviteCode = useCallback(
    (onSuccess?: () => void, onFail?: () => void) => {
      Dialog.confirm({
        showExitButton: false,
        icon: 'InputOutline',
        title: intl.formatMessage({
          id: ETranslations.earn_referral_change_invite_code_title,
        }),
        renderContent: <InviteCode onSuccess={onSuccess} onFail={onFail} />,
      });
    },
    [intl],
  );

  const { copyText } = useClipboard();

  const shareReferRewards = useCallback(
    async (onSuccess?: () => void, onFail?: () => void) => {
      const isBindInviteCode =
        await backgroundApiProxy.serviceReferralCode.isBindInviteCode();
      const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();
      const myReferralCode =
        await backgroundApiProxy.serviceReferralCode.getMyReferralCode();

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
                {/* <SizableText mt="$1" size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.earn_referral_for_you_reward,
                  })}
                </SizableText> */}
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
                      number: '3%',
                    },
                  )}
                </SizableText>
              </YStack>
            </XStack>
          </YStack>
        ),
        showCancelButton: !isLogin || !isBindInviteCode,
        onCancelText: intl.formatMessage({
          id: ETranslations.global_learn_more,
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

  const bindOrChangeInviteCode = useCallback(
    async (onSuccess?: () => void, onFail?: () => void) => {
      const isBindInviteCode =
        await backgroundApiProxy.serviceReferralCode.isBindInviteCode();
      if (isBindInviteCode) {
        changeInviteCode(onSuccess, onFail);
      } else {
        void bindInviteCode(onSuccess, onFail);
      }
    },
    [bindInviteCode, changeInviteCode],
  );

  return useMemo(
    () => ({
      toReferFriendsPage,
      bindInviteCode,
      shareReferRewards,
      bindOrChangeInviteCode,
      toInviteRewardPage,
    }),
    [
      toReferFriendsPage,
      bindInviteCode,
      shareReferRewards,
      bindOrChangeInviteCode,
      toInviteRewardPage,
    ],
  );
};
