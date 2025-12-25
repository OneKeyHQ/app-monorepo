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
import { FormatHyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  REFERRAL_HELP_LINK,
  buildReferralUrl,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabReferFriendsRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IEndpointEnv } from '@onekeyhq/shared/types/endpoint';

import { useOneKeyAuth } from '../components/OneKeyAuth/useOneKeyAuth';

import useAppNavigation from './useAppNavigation';

export function useToReferFriendsModalByRootNavigation() {
  return useCallback(async () => {
    const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();

    if (platformEnv.isNative) {
      const screen = isLogin
        ? EModalReferFriendsRoutes.InviteReward
        : EModalReferFriendsRoutes.ReferAFriend;

      rootNavigationRef.current?.navigate(ERootRoutes.Modal, {
        screen: EModalRoutes.ReferFriendsModal,
        params: {
          screen,
        },
      });
    } else {
      const screen = isLogin
        ? ETabReferFriendsRoutes.TabInviteReward
        : ETabReferFriendsRoutes.TabReferAFriend;

      rootNavigationRef.current?.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.ReferFriends,
        params: {
          screen,
        },
      });
    }
  }, []);
}

export function useReplaceToReferFriends() {
  const navigation = useAppNavigation();

  return useCallback(
    async (params?: {
      utmSource?: string;
      code?: string;
      /** Skip isLoggedIn check when caller already knows login state */
      isLoggedIn?: boolean;
    }) => {
      const { isLoggedIn: knownLoginState, ...navParams } = params ?? {};
      const isLogin =
        knownLoginState ?? (await backgroundApiProxy.servicePrime.isLoggedIn());

      if (platformEnv.isNative) {
        const screen = isLogin
          ? EModalReferFriendsRoutes.InviteReward
          : EModalReferFriendsRoutes.ReferAFriend;
        navigation.replace(screen, navParams);
      } else {
        const screen = isLogin
          ? ETabReferFriendsRoutes.TabInviteReward
          : ETabReferFriendsRoutes.TabReferAFriend;
        navigation.replace(screen, navParams);
      }
    },
    [navigation],
  );
}

export const useReferFriends = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { loginOneKeyId } = useOneKeyAuth();
  const [devSettings] = useDevSettingsPersistAtom();

  const env: IEndpointEnv = useMemo(() => {
    const useTestEnv =
      devSettings.enabled && devSettings.settings?.enableTestEndpoint;
    return useTestEnv ? 'test' : 'prod';
  }, [devSettings.enabled, devSettings.settings?.enableTestEndpoint]);

  const toInviteRewardPage = useCallback(async () => {
    const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();
    if (isLogin) {
      if (platformEnv.isNative) {
        navigation.pushModal(EModalRoutes.ReferFriendsModal, {
          screen: EModalReferFriendsRoutes.InviteReward,
        });
      } else {
        navigation.switchTab<ETabRoutes.ReferFriends>(ETabRoutes.ReferFriends, {
          screen: ETabReferFriendsRoutes.TabInviteReward,
        });
      }
    } else {
      void loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: false });
    }
  }, [loginOneKeyId, navigation]);

  const toReferFriendsPage = useCallback(async () => {
    const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();
    const isVisited = await backgroundApiProxy.serviceSpotlight.isVisited(
      ESpotlightTour.referAFriend,
    );

    const shouldShowInviteReward = isLogin && isVisited;

    if (platformEnv.isNative) {
      // Native: use Modal
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: shouldShowInviteReward
          ? EModalReferFriendsRoutes.InviteReward
          : EModalReferFriendsRoutes.ReferAFriend,
      });
    } else {
      // Web: use Tab
      navigation.switchTab<ETabRoutes.ReferFriends>(ETabRoutes.ReferFriends, {
        screen: shouldShowInviteReward
          ? ETabReferFriendsRoutes.TabInviteReward
          : ETabReferFriendsRoutes.TabReferAFriend,
      });
    }
  }, [navigation]);

  const { copyText } = useClipboard();

  const shareReferRewards = useCallback(
    async (
      _onSuccess?: () => void,
      _onFail?: () => void,
      source: 'Earn' | 'Perps' = 'Earn',
      copyAsUrl = false,
    ) => {
      const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();
      const myReferralCode =
        await backgroundApiProxy.serviceReferralCode.getMyReferralCode();

      const postConfig: IInvitePostConfig | undefined =
        await backgroundApiProxy.serviceReferralCode.getPostConfig();

      const sourceConfig: IInvitePostConfig['locales']['Earn'] =
        source === 'Perps' && postConfig?.locales.Perps
          ? postConfig.locales.Perps
          : postConfig?.locales.Earn ?? {
              title: '',
              subtitle: '',
              for_you: { title: '', subtitle: '' },
              for_your_friend: { title: '', subtitle: '' },
            };

      const getReferralUrl = (code: string) =>
        buildReferralUrl({
          code,
          source,
          env,
        });

      const copyContent = copyAsUrl
        ? getReferralUrl(myReferralCode)
        : myReferralCode;

      const handleConfirm = () => {
        if (isLogin) {
          if (platformEnv.isNative) {
            navigation.pushModal(EModalRoutes.ReferFriendsModal, {
              screen: EModalReferFriendsRoutes.InviteReward,
            });
          } else {
            navigation.switchTab<ETabRoutes.ReferFriends>(
              ETabRoutes.ReferFriends,
              {
                screen: ETabReferFriendsRoutes.TabInviteReward,
              },
            );
          }
        } else {
          void loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: false });
        }
      };

      const dialog = Dialog.show({
        icon: 'GiftOutline',
        title: sourceConfig?.title,
        description: (
          <FormatHyperlinkText
            size="$bodyMd"
            underlineTextProps={{ color: '$textInfo' }}
            onAction={() => {
              void dialog.close();
            }}
          >
            {sourceConfig?.subtitle}
          </FormatHyperlinkText>
        ),
        renderContent: isLogin ? (
          <YStack gap="$5">
            <YStack gap="$2">
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({ id: ETranslations.referral_your_code })}
              </SizableText>
              <XStack
                gap="$3"
                bg="$bgStrong"
                borderRadius="$2"
                px="$2"
                py="$1.5"
                justifyContent="space-between"
                alignItems="center"
              >
                <SizableText size="$bodyLgMedium">{myReferralCode}</SizableText>
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

            {copyAsUrl ? (
              <YStack gap="$2">
                <SizableText size="$bodyMdMedium">
                  {intl.formatMessage({
                    id: ETranslations.referral_referral_link,
                  })}
                </SizableText>
                <XStack
                  gap="$3"
                  bg="$bgStrong"
                  borderRadius="$2"
                  px="$2"
                  py="$1.5"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <SizableText
                    size="$bodyLgMedium"
                    numberOfLines={1}
                    flexShrink={1}
                  >
                    {copyContent}
                  </SizableText>
                  <IconButton
                    title={intl.formatMessage({
                      id: ETranslations.global_copy,
                    })}
                    variant="tertiary"
                    icon="Copy3Outline"
                    size="small"
                    iconColor="$iconSubdued"
                    flexShrink={0}
                    onPress={() => {
                      copyText(copyContent);
                      defaultLogger.referral.page.copyReferralCode();
                    }}
                  />
                </XStack>
              </YStack>
            ) : null}
          </YStack>
        ) : (
          <YStack gap="$5">
            <XStack gap="$4">
              <XStack h={42} w={42} p={9} borderRadius={13} bg="$bgSuccess">
                <Icon name="PeopleOutline" color="$iconSuccess" size={20} />
              </XStack>
              <YStack flexShrink={1}>
                <SizableText size="$headingMd">
                  {sourceConfig?.for_you?.title}
                </SizableText>
                <SizableText mt="$1" size="$bodyMd" color="$textSubdued">
                  {sourceConfig?.for_you?.subtitle}
                </SizableText>
              </YStack>
            </XStack>
            <XStack gap="$4">
              <XStack h={42} w={42} p={9} borderRadius={13} bg="$bgInfo">
                <Icon name="PeopleLikeOutline" color="$iconInfo" size={20} />
              </XStack>
              <YStack flexShrink={1}>
                <SizableText size="$headingMd">
                  {sourceConfig?.for_your_friend?.title}
                </SizableText>
                <SizableText mt="$1" size="$bodyMd" color="$textSubdued">
                  {sourceConfig?.for_your_friend?.subtitle}
                </SizableText>
              </YStack>
            </XStack>
          </YStack>
        ),
        onCancelText: intl.formatMessage({
          id: ETranslations.referral_intro_learn_more,
        }),
        onCancel: () => {
          openUrlExternal(REFERRAL_HELP_LINK);
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
    [copyText, intl, loginOneKeyId, navigation, env],
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
