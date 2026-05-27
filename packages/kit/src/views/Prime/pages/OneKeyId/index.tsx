import { Fragment, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { ColorTokens, IKeyOfIcons } from '@onekeyhq/components';
import {
  ActionList,
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
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useConfirmOneKeyIdLogout } from '@onekeyhq/kit/src/components/OneKeyAuth/useConfirmOneKeyIdLogout';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { OneKeyIdAvatar } from '@onekeyhq/kit/src/components/OneKeyIdAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

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
      onPress={onPress}
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
}: {
  onDeleteAccount: () => void;
}) {
  const intl = useIntl();
  const renderItems = useCallback(
    ({ handleActionListClose }: { handleActionListClose: () => void }) => (
      <ActionList.Item
        icon="RemovePeopleOutline"
        label={intl.formatMessage({ id: ETranslations.id_delete_onekey_id })}
        destructive
        onClose={handleActionListClose}
        onPress={onDeleteAccount}
      />
    ),
    [intl, onDeleteAccount],
  );

  return (
    <ActionList
      title={ONEKEY_ID_TITLE}
      floatingPanelProps={{ w: '$64' }}
      renderItems={renderItems}
      renderTrigger={
        <OneKeyIdActionItem
          icon="SettingsOutline"
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
}: {
  displayName: string;
  textSize: '$headingMd' | '$headingLg';
  centered?: boolean;
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
      <PrimeUserBadge showFreeStatus={false} />
    </XStack>
  );
}

function OneKeyIdProfilePanel({
  onEditProfile,
  onLogout,
  onClose,
}: {
  onEditProfile: () => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  const intl = useIntl();
  const media = useMedia();
  const { user } = useOneKeyAuth();
  const displayName = user?.nickname || user?.displayEmail || ONEKEY_ID_TITLE;
  const email = user?.displayEmail || user?.email || ONEKEY_ID_TITLE;
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
          cursor="pointer"
          onPress={onEditProfile}
          pressStyle={{ opacity: 0.7 }}
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
              />
              <IconButton
                icon="EditOutline"
                size="small"
                iconSize="$5"
                variant="tertiary"
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
  const { isLoggedIn, logout, user } = useOneKeyAuth();
  const logoutRef = useRef<() => Promise<void>>(logout);
  const isFocused = useRouteIsFocused();
  const isExplicitLogoutRef = useRef(false);
  const isPrime = user?.primeSubscription?.isActive;
  const subscriptionManageUrl = user?.subscriptionManageUrl;

  logoutRef.current = logout;

  const handleEditProfile = useCallback(() => {
    navigation.push(EPrimePages.OneKeyIdProfileEdit);
  }, [navigation]);

  const handleDeviceManagement = useCallback(() => {
    navigation.push(EPrimePages.PrimeDeviceLimit);
  }, [navigation]);

  const handleMyOrders = useCallback(() => {
    navigation.push(EPrimePages.PrimeMyOrders);
  }, [navigation]);

  const handleDeleteAccount = useCallback(() => {
    navigation.push(EPrimePages.PrimeDeleteAccount);
  }, [navigation]);

  const handleClose = useCallback(() => {
    resetPrimeModal();
  }, []);

  const handleManageSubscription = useCallback(() => {
    if (subscriptionManageUrl) {
      openUrlUtils.openUrlExternal(subscriptionManageUrl);
    }
  }, [subscriptionManageUrl]);

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
      void logoutRef.current();
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

  const handleLogout = useConfirmOneKeyIdLogout({
    reason: 'OneKeyIdPage Logout Button',
    onBeforeLogout: handleBeforeLogout,
    onSuccess: handleLogoutSuccess,
  });

  const manageServiceActions: IOneKeyIdAction[] = [];
  if (isPrimeAvailable) {
    manageServiceActions.push({
      key: 'prime',
      icon: 'PrimeOutline',
      title: ONEKEY_PRIME_TITLE,
      subtitle: intl.formatMessage({
        id: ETranslations.id_prime,
      }),
      onPress: toPrimePage,
    });
  }
  if (isPrime && subscriptionManageUrl) {
    manageServiceActions.push({
      key: 'subscription',
      icon: 'CreditCardOutline',
      title: intl.formatMessage({
        id: ETranslations.prime_manage_subscription,
      }),
      onPress: handleManageSubscription,
    });
  }
  manageServiceActions.push(
    {
      key: 'refer',
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
      icon: 'MultipleDevicesOutline',
      title: intl.formatMessage({
        id: ETranslations.prime_device_management,
      }),
      onPress: handleDeviceManagement,
    },
    {
      key: 'orders',
      icon: 'CartOutline',
      title: intl.formatMessage({
        id: ETranslations.prime_my_order,
      }),
      onPress: handleMyOrders,
    },
  );

  return (
    <Page>
      <Page.Header title={ONEKEY_ID_TITLE} headerShown={!media.gtMd} />
      <Page.Body>
        <ScrollView flex={1} contentContainerStyle={{ flexGrow: 1 }}>
          <YStack
            px="$5"
            pt="$0"
            pb="$4"
            gap="$4"
            flex={1}
            $gtMd={{
              p: '$0',
              gap: '$0',
              flexDirection: 'row',
            }}
          >
            <OneKeyIdProfilePanel
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
              <OneKeyIdSection
                title={intl.formatMessage({
                  id: ETranslations.prime_manage_service,
                })}
              >
                {manageServiceActions.map((action, index) => {
                  const { key, ...actionProps } = action;
                  return (
                    <Fragment key={key}>
                      <OneKeyIdActionItem {...actionProps} />
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
                  onDeleteAccount={handleDeleteAccount}
                />
              </OneKeyIdSection>
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
