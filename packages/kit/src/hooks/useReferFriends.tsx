import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  Icon,
  IconButton,
  OTPInput,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from './useAppNavigation';
import { useLoginOneKeyId } from './useLoginOneKeyId';

const NUMBER_OF_DIGITS = 6;
function InviteCode() {
  const [verificationCode, setVerificationCode] = useState('');
  const handleConfirm = useCallback(() => {
    void backgroundApiProxy.serviceReferralCode.bindInviteCode(
      verificationCode,
    );
  }, [verificationCode]);
  return (
    <YStack>
      <OTPInput
        autoFocus
        status="normal"
        numberOfDigits={NUMBER_OF_DIGITS}
        value={verificationCode}
        onTextChange={(value) => {
          setVerificationCode(value.toUpperCase());
        }}
      />
      <Dialog.Footer
        showCancelButton={false}
        confirmButtonProps={{
          disabled: verificationCode.length !== NUMBER_OF_DIGITS,
        }}
        onConfirm={handleConfirm}
      />
    </YStack>
  );
}

export const useReferFriends = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { loginOneKeyId } = useLoginOneKeyId();

  const toReferFriendsPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.ReferAFriend,
    });
  }, [navigation]);
  const bindInviteCode = useCallback(() => {
    Dialog.confirm({
      showExitButton: false,
      icon: 'InputOutline',
      title: 'Enter invite code',
      description:
        'Use an invite code to receive {number%} yield boost in this vault',
      renderContent: <InviteCode />,
    });
  }, []);
  const { copyText } = useClipboard();

  const shareReferRewards = useCallback(async () => {
    const isBindInviteCode =
      await backgroundApiProxy.serviceReferralCode.isBindInviteCode();
    const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();
    const text = 'GMGMGM';

    const handleConfirm = () => {
      if (isLogin) {
        navigation.pushModal(EModalRoutes.ReferFriendsModal, {
          screen: EModalReferFriendsRoutes.ReferAFriend,
        });
      } else {
        void loginOneKeyId();
      }
    };
    Dialog.show({
      icon: 'GiftOutline',
      title: 'Referral and earn more!',
      description:
        'Invite friends to deposit in Supported Vaults and earn more rewards.',
      renderContent: isLogin ? (
        <YStack gap="$5">
          <YStack gap="$2">
            <SizableText size="$bodyMdMedium">Referral link</SizableText>
            <XStack
              borderColor="rgba(0, 0, 0, 0.13)"
              bg="$bgDisabled"
              px="$3"
              py="$1.5"
              borderWidth={StyleSheet.hairlineWidth}
              jc="space-between"
              ai="center"
              borderRadius="$2.5"
            >
              <SizableText size="$bodyLg" flexShrink={1}>
                onekey.so/r/GMGMGM
              </SizableText>
              <XStack ai="center" gap="$2.5">
                <IconButton
                  title={intl.formatMessage({ id: ETranslations.global_copy })}
                  variant="tertiary"
                  icon="Copy3Outline"
                  size="large"
                  iconColor="$iconSubdued"
                  onPress={() => copyText(text)}
                />
                <IconButton
                  title={intl.formatMessage({ id: ETranslations.global_copy })}
                  variant="tertiary"
                  icon="ShareOutline"
                  size="large"
                  iconColor="$iconSubdued"
                  onPress={() => copyText('onekey.so/r/GMGMGM')}
                />
              </XStack>
            </XStack>
          </YStack>
          <YStack gap="$1">
            <SizableText size="$bodyMdMedium">Referral code</SizableText>
            <XStack gap="$3" ai="center">
              <SizableText size="$headingXl">{text}</SizableText>
              <IconButton
                title={intl.formatMessage({ id: ETranslations.global_copy })}
                variant="tertiary"
                icon="Copy3Outline"
                size="small"
                iconColor="$iconSubdued"
                onPress={() => copyText('GMGMGM')}
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
            <YStack>
              <SizableText size="$headingMd">For You</SizableText>
              <SizableText mt="$1" size="$bodyMd" color="$textSubdued">
                Unlock lifetime rewards from your friends’ fee sharing
              </SizableText>
            </YStack>
          </XStack>
          <XStack gap="$4">
            <XStack h={42} w={42} p={9} borderRadius={13} bg="$bgInfo">
              <Icon name="PeopleLikeOutline" color="$iconInfo" size={20} />
            </XStack>
            <YStack>
              <SizableText size="$headingMd">For Your Friend</SizableText>
              <SizableText mt="$1" size="$bodyMd" color="$textSubdued">
                Get yield boost
              </SizableText>
            </YStack>
          </XStack>
        </YStack>
      ),
      showCancelButton: !isBindInviteCode,
      dismissOnOverlayPress: !isBindInviteCode,
      onCancelText: 'Add invite code',
      onCancel: () => {
        if (!isBindInviteCode) {
          bindInviteCode();
        }
      },
      onConfirmText: isLogin ? 'View rewards' : 'Join',
      onConfirm: handleConfirm,
    });
  }, [bindInviteCode, copyText, intl, loginOneKeyId, navigation]);

  return useMemo(
    () => ({ toReferFriendsPage, bindInviteCode, shareReferRewards }),
    [toReferFriendsPage, bindInviteCode, shareReferRewards],
  );
};
