import { Fragment, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { ColorTokens, IKeyOfIcons } from '@onekeyhq/components';
import {
  ActionList,
  Alert,
  Button,
  Divider,
  IconButton,
  NavCloseButton,
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  resetPrimeModal,
  resetToRoute,
  rootNavigationRef,
  useMedia,
  useUpdateEffect,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { getDisplayEmailOrUnknown } from '@onekeyhq/kit/src/components/OneKeyAuth/oneKeyIdDisplayEmailUtils';
import { useConfirmOneKeyIdLogout } from '@onekeyhq/kit/src/components/OneKeyAuth/useConfirmOneKeyIdLogout';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { OneKeyIdAvatar } from '@onekeyhq/kit/src/components/OneKeyIdAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  isPrimeUserBannedMockEnabled,
  primeUserBannedMessage,
} from '@onekeyhq/shared/src/prime/primeUserBanned';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { OneKeyIdLegacyOAuthBindPrompt } from '../../components/OneKeyIdLegacyOAuthBind/OneKeyIdLegacyOAuthBind';
import { PrimeUserBadge } from '../../components/PrimeUserBadge';
import { usePrimeAvailable } from '../../hooks/usePrimeAvailable';
import { PrimeTestIDs } from '../../testIDs';

const ONEKEY_ID_ACTION_ICON_STYLE = {
  width: 22,
  height: 22,
};

const ONEKEY_ID_TITLE = 'OneKey ID';
const ONEKEY_ID_EMAIL_LABEL = 'Email';
const ONEKEY_PRIME_TITLE = 'OneKey Prime';

const ONEKEY_ID_PROFILE_CARD_SHADOW =
  '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';

type IOneKeyIdActionItemProps = {
  icon: IKeyOfIcons;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  titleColor?: ColorTokens;
  drillIn?: boolean;
  testID?: string;
  disabled?: boolean;
};

type IOneKeyIdAction = IOneKeyIdActionItemProps & {
  key: string;
};

function OneKeyIdActionItem({
  icon,
  title,
  subtitle,
  onPress,
  titleColor,
  drillIn = true,
  testID,
  disabled = false,
}: IOneKeyIdActionItemProps) {
  const media = useMedia();

  return (
    <ListItem
      testID={testID}
      py="$3"
      px="$4"
      mx="$-2"
      borderRadius="$3"
      userSelect="none"
      drillIn={drillIn}
      icon={icon}
      iconProps={{
        style: ONEKEY_ID_ACTION_ICON_STYLE,
        color: '$iconSubdued',
      }}
      title={title}
      subtitle={media.gtMd ? subtitle : undefined}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      titleProps={{
        size: media.gtMd ? '$bodyMdMedium' : '$bodyLgMedium',
        color: titleColor,
      }}
      subtitleProps={{ size: '$bodySm' }}
      $gtMd={{ px: '$4', mx: 0, borderRadius: 0 }}
    />
  );
}

function SectionDivider() {
  return (
    <XStack display="none" ml="$14" $gtMd={{ display: 'flex' }}>
      <Divider borderColor="$neutral3" borderBottomWidth={1} />
    </XStack>
  );
}

function OneKeyIdSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <YStack gap="$2">
      <SizableText
        size="$bodyMdMedium"
        color="$textSubdued"
        px="$2"
        $gtMd={{ px: '$4' }}
      >
        {title}
      </SizableText>
      <YStack
        bg="$transparent"
        borderWidth={0}
        borderColor="$neutral3"
        borderRadius={0}
        overflow="visible"
        $gtMd={{
          bg: '$bgSubdued',
          borderWidth: 1,
          borderRadius: '$2.5',
          overflow: 'hidden',
        }}
      >
        {children}
      </YStack>
    </YStack>
  );
}

function OneKeyIdAccountManagementItem({
  onDeleteAccount,
  isBanned,
}: {
  onDeleteAccount: () => void;
  isBanned: boolean;
}) {
  const intl = useIntl();
  const renderItems = useCallback(
    ({ handleActionListClose }: { handleActionListClose: () => void }) => (
      <ActionList.Item
        testID={PrimeTestIDs.oneKeyIdDeleteAccountBtn}
        icon="RemovePeopleOutline"
        label={intl.formatMessage({ id: ETranslations.id_delete_onekey_id })}
        destructive
        onClose={handleActionListClose}
        onPress={onDeleteAccount}
      />
    ),
    [intl, onDeleteAccount],
  );

  if (isBanned) {
    return (
      <OneKeyIdActionItem
        icon="RemovePeopleOutline"
        title={intl.formatMessage({ id: ETranslations.id_delete_onekey_id })}
        titleColor="$textCritical"
        onPress={onDeleteAccount}
        testID={PrimeTestIDs.oneKeyIdDeleteAccountBtn}
      />
    );
  }

  return (
    <ActionList
      title={ONEKEY_ID_TITLE}
      floatingPanelProps={{ w: '$64' }}
      renderItems={renderItems}
      renderTrigger={
        <OneKeyIdActionItem
          icon="SettingsOutline"
          testID={PrimeTestIDs.oneKeyIdAccountManagementBtn}
          title={intl.formatMessage({
            id: ETranslations.global_manage_accounts,
          })}
        />
      }
    />
  );
}

function OneKeyIdProfileNameBadge({
  displayName,
  textSize,
  centered,
  disabled,
}: {
  displayName: string;
  textSize: '$headingMd' | '$headingLg';
  centered?: boolean;
  disabled: boolean;
}) {
  return (
    <XStack
      ai="center"
      gap="$1.5"
      flex={centered ? undefined : 1}
      w={centered ? '100%' : undefined}
      minWidth={0}
      $gtMd={centered ? { jc: 'center' } : undefined}
    >
      <SizableText
        flexShrink={1}
        minWidth={0}
        size={textSize}
        color="$text"
        numberOfLines={1}
        ellipsizeMode="tail"
        $gtMd={centered ? { textAlign: 'center' } : undefined}
      >
        {displayName}
      </SizableText>
      <PrimeUserBadge showFreeStatus={false} disabled={disabled} />
    </XStack>
  );
}

function OneKeyIdProfilePanel({
  onEditProfile,
  onLogout,
  onClose,
  isBanned,
}: {
  onEditProfile: () => void;
  onLogout: () => void;
  onClose: () => void;
  isBanned: boolean;
}) {
  const intl = useIntl();
  const media = useMedia();
  const { user } = useOneKeyAuth();
  const displayEmail = getDisplayEmailOrUnknown({
    intl,
    displayEmail: user?.displayEmail,
  });
  const displayName = user?.nickname || displayEmail;
  const email = displayEmail;
  const avatarSize = media.gtMd ? '$20' : '$12';
  const nameTextSize = media.gtMd ? '$headingMd' : '$headingLg';
  const emailTextSize = '$bodyMd';
  const editProfileLabel = intl.formatMessage({
    id: ETranslations.settings_edit_profile,
  });

  return (
    <YStack
      p="$0"
      gap="$4"
      $gtMd={{
        w: 200,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
        px: '$3',
        pt: '$3',
        pb: '$6',
      }}
    >
      <YStack gap="$4">
        <XStack
          display="none"
          $gtMd={{ display: 'flex' }}
          ai="center"
          gap="$3"
          mb="$2"
        >
          <NavCloseButton onPress={onClose} />
          <SizableText
            flex={1}
            size="$headingLg"
            color="$text"
            userSelect="none"
          >
            {ONEKEY_ID_TITLE}
          </SizableText>
        </XStack>

        <XStack
          ai="center"
          gap="$3"
          p="$4"
          bg="$neutral2"
          borderWidth={1}
          borderColor="$neutral3"
          borderRadius="$3"
          borderCurve="continuous"
          $platform-web={{ boxShadow: ONEKEY_ID_PROFILE_CARD_SHADOW }}
          testID={PrimeTestIDs.oneKeyIdProfileCard}
          disabled={isBanned}
          accessibilityState={{ disabled: isBanned }}
          cursor={isBanned ? 'default' : 'pointer'}
          onPress={isBanned ? undefined : onEditProfile}
          pressStyle={isBanned ? undefined : { opacity: 0.7 }}
          $gtMd={{ display: 'none' }}
        >
          <YStack flex={1} gap="$4">
            <XStack ai="center" gap="$3">
              <Stack position="relative" flexShrink={0}>
                <OneKeyIdAvatar size={avatarSize} />
              </Stack>
              <OneKeyIdProfileNameBadge
                displayName={displayName}
                textSize={nameTextSize}
                disabled={isBanned}
              />
              <IconButton
                icon="EditOutline"
                size="small"
                iconSize="$5"
                variant="tertiary"
                disabled={isBanned}
                onPress={(e) => {
                  e.stopPropagation();
                  onEditProfile();
                }}
                testID={PrimeTestIDs.oneKeyIdEditProfileBtn}
              />
            </XStack>
            <XStack
              ai="center"
              gap="$3"
              jc="space-between"
              pt="$3"
              borderTopWidth={1}
              borderTopColor="$neutral3"
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {ONEKEY_ID_EMAIL_LABEL}
              </SizableText>
              <SizableText
                flex={1}
                minWidth={0}
                size="$bodyMd"
                color="$text"
                numberOfLines={1}
                ellipsizeMode="middle"
                textAlign="right"
              >
                {email}
              </SizableText>
            </XStack>
          </YStack>
        </XStack>

        <XStack
          display="none"
          ai="center"
          gap="$3"
          $gtMd={{
            display: 'flex',
            flexDirection: 'column',
            gap: '$3.5',
            p: '$0',
          }}
        >
          <Stack position="relative" flexShrink={0}>
            <OneKeyIdAvatar size={avatarSize} />
          </Stack>
          <YStack
            flex={1}
            minWidth={0}
            gap="$1.5"
            $gtMd={{
              alignItems: 'center',
              width: '100%',
            }}
          >
            <OneKeyIdProfileNameBadge
              displayName={displayName}
              textSize={nameTextSize}
              centered
              disabled={isBanned}
            />
            <SizableText
              size={emailTextSize}
              color="$textSubdued"
              numberOfLines={1}
              ellipsizeMode="middle"
              $gtMd={{ textAlign: 'center' }}
            >
              {email}
            </SizableText>
          </YStack>
        </XStack>

        {media.gtMd ? (
          <Button
            icon="EditOutline"
            size="small"
            px="$3.5"
            bg="$transparent"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$neutral3"
            onPress={onEditProfile}
            disabled={isBanned}
            testID={PrimeTestIDs.oneKeyIdEditProfileBtn}
            alignSelf="center"
          >
            {editProfileLabel}
          </Button>
        ) : null}
      </YStack>

      {media.gtMd ? (
        <YStack mt="auto" pt="$4">
          <Button
            variant="tertiary"
            size="small"
            onPress={onLogout}
            testID={PrimeTestIDs.oneKeyIdLogoutBtn}
          >
            {intl.formatMessage({ id: ETranslations.prime_log_out })}
          </Button>
        </YStack>
      ) : null}
    </YStack>
  );
}

function OneKeyIdPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const media = useMedia();
  const { toInviteRewardPage } = useReferFriends();
  const { isPrimeAvailable } = usePrimeAvailable();
  const { isLoggedIn, user } = useOneKeyAuth();
  const [devSettings] = useDevSettingsPersistAtom();
  const isMock = isPrimeUserBannedMockEnabled(devSettings, platformEnv);
  const isBanned = Boolean(user?.isOneKeyIdBanned || isMock);
  const isFocused = useRouteIsFocused();
  const isExplicitLogoutRef = useRef(false);

  const handleEditProfile = useCallback(() => {
    if (!isBanned) {
      navigation.push(EPrimePages.OneKeyIdProfileEdit);
    }
  }, [isBanned, navigation]);

  const handleDeviceManagement = useCallback(() => {
    navigation.push(EPrimePages.PrimeDeviceLimit);
  }, [navigation]);

  const handleMyOrders = useCallback(() => {
    navigation.push(EPrimePages.PrimeMyOrders);
  }, [navigation]);

  const handleDeleteAccount = useCallback(() => {
    if (isBanned) {
      navigation.pushModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDeleteAccount,
      });
      return;
    }
    navigation.push(EPrimePages.PrimeDeleteAccount);
  }, [isBanned, navigation]);

  const handleClose = useCallback(() => {
    resetPrimeModal();
  }, []);

  const toPrimePage = useCallback(() => {
    requestIdleCallback(async () => {
      try {
        if (isPrimeAvailable) {
          if (platformEnv.isNative) {
            resetToRoute(ERootRoutes.iOSFullScreen, {
              screen: EModalRoutes.PrimeModal,
              params: {
                screen: EPrimePages.PrimeDashboard,
              },
            });
          } else {
            rootNavigationRef.current?.navigate(ERootRoutes.iOSFullScreen, {
              screen: EModalRoutes.PrimeModal,
              params: {
                screen: EPrimePages.PrimeDashboard,
              },
            });
          }
        }
      } catch (e) {
        defaultLogger.prime.subscription.onekeyIdLogout({
          reason: `OneKeyIdPage: toPrimePage navigation error: ${String(e)}`,
        });
      }
    });
  }, [isPrimeAvailable]);

  const handleLoggedOutWhileFocused = useCallback(async () => {
    if (isExplicitLogoutRef.current) {
      return;
    }
    if (!isLoggedIn && isFocused) {
      await timerUtils.wait(300);
      resetPrimeModal();
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason:
          'OneKeyIdPage: is focused and primePersistAtom is not logged in',
      });
    }
  }, [isLoggedIn, isFocused]);

  useUpdateEffect(() => {
    void handleLoggedOutWhileFocused();
  }, [handleLoggedOutWhileFocused]);

  const handleBeforeLogout = useCallback(() => {
    isExplicitLogoutRef.current = true;
  }, []);

  const handleLogoutSuccess = useCallback(() => {
    defaultLogger.referral.page.logoutOneKeyIDResult();
    resetPrimeModal();
  }, []);

  const logout = useConfirmOneKeyIdLogout({
    reason: 'OneKeyIdPage Logout Button',
    onBeforeLogout: handleBeforeLogout,
    onSuccess: handleLogoutSuccess,
  });

  const handleLogout = useCallback(async () => {
    if (isMock) {
      await backgroundApiProxy.serviceDevSetting.updateDevSetting(
        'mockPrimeUserBanned',
        false,
      );
      resetPrimeModal();
      return;
    }
    logout();
  }, [isMock, logout]);

  const manageServiceActions: IOneKeyIdAction[] = [];
  if (isPrimeAvailable) {
    manageServiceActions.push({
      key: 'prime',
      testID: PrimeTestIDs.oneKeyIdPrimeBtn,
      icon: 'PrimeOutline',
      title: ONEKEY_PRIME_TITLE,
      subtitle: intl.formatMessage({
        id: ETranslations.id_prime,
      }),
      onPress: toPrimePage,
    });
  }
  manageServiceActions.push(
    {
      key: 'refer',
      testID: PrimeTestIDs.oneKeyIdReferralBtn,
      icon: 'GiftOutline',
      title: intl.formatMessage({
        id: ETranslations.id_refer_a_friend,
      }),
      subtitle: intl.formatMessage({
        id: ETranslations.id_refer_a_friend_desc,
      }),
      onPress: toInviteRewardPage,
    },
    {
      key: 'devices',
      testID: PrimeTestIDs.oneKeyIdDevicesBtn,
      icon: 'MultipleDevicesOutline',
      title: intl.formatMessage({
        id: ETranslations.prime_device_management,
      }),
      onPress: handleDeviceManagement,
    },
    {
      key: 'orders',
      testID: PrimeTestIDs.oneKeyIdOrdersBtn,
      icon: 'CartOutline',
      title: intl.formatMessage({
        id: ETranslations.prime_my_order,
      }),
      onPress: handleMyOrders,
    },
  );

  return (
    <Page testID={PrimeTestIDs.oneKeyIdPage}>
      <Page.Header title={ONEKEY_ID_TITLE} headerShown={!media.gtMd} />
      <Page.Body>
        <ScrollView flex={1} contentContainerStyle={{ flexGrow: 1 }}>
          <YStack
            px="$5"
            pt="$0"
            pb="$8"
            gap="$4"
            flex={1}
            $gtMd={{
              p: '$0',
              gap: '$0',
              flexDirection: 'row',
            }}
          >
            <OneKeyIdProfilePanel
              isBanned={isBanned}
              onEditProfile={handleEditProfile}
              onLogout={handleLogout}
              onClose={handleClose}
            />

            <YStack
              flex={1}
              gap="$5"
              $gtMd={{
                p: '$6',
                gap: '$5',
              }}
            >
              {isBanned ? (
                <YStack gap="$3">
                  <Alert
                    testID={PrimeTestIDs.oneKeyIdBannedAlert}
                    type="critical"
                    title={intl.formatMessage(primeUserBannedMessage)}
                  />
                  {isMock ? (
                    <SizableText color="$textSubdued" size="$bodySm">
                      Local mock: no server requests. Log out exits the mock.
                    </SizableText>
                  ) : null}
                </YStack>
              ) : null}
              <OneKeyIdSection
                title={intl.formatMessage({
                  id: ETranslations.prime_manage_service,
                })}
              >
                {manageServiceActions.map((action, index) => {
                  const { key, ...actionProps } = action;
                  return (
                    <Fragment key={key}>
                      <OneKeyIdActionItem
                        {...actionProps}
                        disabled={isBanned}
                      />
                      {index < manageServiceActions.length - 1 ? (
                        <SectionDivider />
                      ) : null}
                    </Fragment>
                  );
                })}
              </OneKeyIdSection>

              <OneKeyIdSection
                title={intl.formatMessage({
                  id: ETranslations.global_advanced,
                })}
              >
                <OneKeyIdAccountManagementItem
                  isBanned={isBanned}
                  onDeleteAccount={handleDeleteAccount}
                />
              </OneKeyIdSection>

              {!isBanned ? (
                <OneKeyIdLegacyOAuthBindPrompt
                  isLoggedIn={Boolean(isLoggedIn)}
                  isFocused={isFocused}
                />
              ) : null}
            </YStack>
          </YStack>
        </ScrollView>
      </Page.Body>
      {!media.gtMd ? (
        <Page.Footer>
          <YStack bg="$bgApp" ai="stretch" px="$5" pt="$2" pb="$5">
            <Button
              variant="secondary"
              size="large"
              w="100%"
              onPress={handleLogout}
              testID={PrimeTestIDs.oneKeyIdLogoutBtn}
            >
              {intl.formatMessage({ id: ETranslations.prime_log_out })}
            </Button>
          </YStack>
        </Page.Footer>
      ) : null}
    </Page>
  );
}

export default function OneKeyId() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <OneKeyIdPage />
    </AccountSelectorProviderMirror>
  );
}
