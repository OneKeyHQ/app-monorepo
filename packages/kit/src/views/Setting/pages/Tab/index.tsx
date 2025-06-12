import { type ReactElement, useCallback, useMemo } from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Icon,
  IconButton,
  NavCloseButton,
  SearchBar,
  SizableText,
  TabSubStackNavigator,
  XStack,
  YStack,
  useIsHorizontalLayout,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ECloudBackupRoutes,
  EDAppConnectionModal,
  ELiteCardRoutes,
  EModalAddressBookRoutes,
  EModalKeyTagRoutes,
  EModalRoutes,
  EModalSettingRoutes,
} from '@onekeyhq/shared/src/routes';

import { useOnLock } from '../List/DefaultSection';

import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';

const Tab = createBottomTabNavigator();

function Setting1() {
  return <SizableText>Setting1</SizableText>;
}

function Setting2() {
  return <SizableText>Setting2</SizableText>;
}

function Setting3() {
  return <SizableText>Setting3</SizableText>;
}

function Setting4() {
  return <SizableText>Setting4</SizableText>;
}

function Setting5() {
  return <SizableText>Setting5</SizableText>;
}

function Setting6() {
  return <SizableText>Setting6</SizableText>;
}

function Setting7() {
  return <SizableText>Setting7</SizableText>;
}

const TAB_CONFIGS: {
  icon: IKeyOfIcons;
  translationId: ETranslations;
  children: () => ReactElement;
}[] = [
  {
    icon: 'CloudUploadSolid',
    translationId: ETranslations.global_backup,
    children: () => (
      <TabSubStackNavigator
        config={[
          {
            name: 'a',
            component: Setting1,
          },
        ]}
      />
    ),
  },
  {
    icon: 'SettingsSolid',
    translationId: ETranslations.global_preferences,
    children: () => (
      <TabSubStackNavigator
        config={[
          {
            name: 'b',
            component: Setting2,
          },
        ]}
      />
    ),
  },
  {
    icon: 'WalletSolid',
    translationId: ETranslations.global_wallet,
    children: () => (
      <TabSubStackNavigator
        config={[
          {
            name: 'c',
            component: Setting3,
          },
        ]}
      />
    ),
  },
  {
    icon: 'Shield2CheckSolid',
    translationId: ETranslations.global_security,
    children: () => (
      <TabSubStackNavigator
        config={[
          {
            name: 'd',
            component: Setting4,
          },
        ]}
      />
    ),
  },
  {
    icon: 'GlobusSolid',
    translationId: ETranslations.global_network,
    children: () => (
      <TabSubStackNavigator
        config={[
          {
            name: 'e',
            component: Setting5,
          },
        ]}
      />
    ),
  },
  {
    icon: 'InfoCircleSolid',
    translationId: ETranslations.global_about,
    children: () => (
      <TabSubStackNavigator
        config={[
          {
            name: 'f',
            component: Setting6,
          },
        ]}
      />
    ),
  },
  {
    icon: 'CodeSolid',
    translationId: ETranslations.global_dev_mode,
    children: () => (
      <TabSubStackNavigator
        config={[
          {
            name: 'g',
            component: Setting7,
          },
        ]}
      />
    ),
  },
];

const SettingsConfig = [
  {
    icon: 'CloudUploadSolid',
    translationId: ETranslations.global_backup,
    configs: [
      [
        platformEnv.isNative
          ? {
              icon: 'RepeatOutline',
              translationId: platformEnv.isNativeAndroid
                ? ETranslations.settings_google_drive_backup
                : ETranslations.settings_icloud_backup,
              navigateTo: ECloudBackupRoutes.CloudBackupHome,
            }
          : null,
        {
          icon: 'CloudOutline',
          translationId: ETranslations.global_onekey_cloud,
        },
      ],
      [
        platformEnv.isNative
          ? {
              icon: 'OnekeyLiteOutline',
              translationId: ETranslations.global_onekey_lite,
              navigateTo: ELiteCardRoutes.LiteCardHome,
            }
          : undefined,
        {
          icon: 'OnekeyKeytagOutline',
          translationId: ETranslations.global_onekey_keytag,
          navigateTo: EModalKeyTagRoutes.UserOptions,
        },
      ].filter(Boolean),
    ],
  },
  {
    icon: 'SettingsSolid',
    translationId: ETranslations.global_preferences,
    configs: [
      [
        platformEnv.isExtension
          ? {
              icon: 'ThumbtackOutline',
              translationId: ETranslations.settings_default_wallet_settings,
              navigateTo: EDAppConnectionModal.DefaultWalletSettingsModal,
            }
          : undefined,
      ].filter(Boolean),
      [
        {
          icon: 'TranslateOutline',
          translationId: ETranslations.global_language,
        },
        {
          icon: 'DollarOutline',
          translationId: ETranslations.settings_default_currency,
        },
        {
          icon: 'PaletteOutline',
          translationId: ETranslations.settings_theme,
        },
      ],
      [
        !platformEnv.isWeb
          ? {
              icon: 'BellOutline',
              translationId: ETranslations.global_notifications,
              navigateTo: EModalSettingRoutes.SettingNotifications,
            }
          : undefined,
      ].filter(Boolean),
      [
        platformEnv.isExtension
          ? {
              icon: 'MenuCircleHorOutline',
              translationId: ETranslations.setting_floating_icon,
              navigateTo: EModalSettingRoutes.SettingFloatingIconModal,
            }
          : undefined,
      ].filter(Boolean),
    ],
  },
  {
    icon: 'WalletSolid',
    translationId: ETranslations.global_wallet,
    configs: [
      [
        {
          icon: 'ContactsOutline',
          translationId: ETranslations.settings_address_book,
          navigateTo: EModalAddressBookRoutes.ListItemModal,
        },
      ],
      [
        !platformEnv.isWeb
          ? {
              icon: 'RefreshCcwOutline',
              translationId: ETranslations.settings_account_sync_modal_title,
              navigateTo: EModalSettingRoutes.SettingAlignPrimaryAccount,
            }
          : undefined,
        {
          icon: 'LabOutline',
          translationId: ETranslations.global_customize_transaction,
          navigateTo: EModalSettingRoutes.SettingCustomTransaction,
        },
      ].filter(Boolean),
      [
        {
          icon: 'BranchesOutline',
          translationId: ETranslations.settings_account_derivation_path,
          navigateTo: EModalSettingRoutes.SettingAccountDerivationModal,
        },
      ],
    ],
  },
  {
    icon: 'Shield2CheckSolid',
    translationId: ETranslations.global_security,
    configs: [[{}]],
  },
];

function TabItemView({
  isActive,
  onPress,
  options,
}: {
  isActive: boolean;
  onPress: () => void;
  options: BottomTabNavigationOptions & {
    tabbarOnPress?: () => void;
    trackId?: string;
  };
}) {
  useMemo(() => {
    // @ts-expect-error
    const activeIcon = options?.tabBarIcon?.(true) as IKeyOfIcons;
    // @ts-expect-error
    const inActiveIcon = options?.tabBarIcon?.(false) as IKeyOfIcons;
    // Avoid icon jitter during lazy loading by prefetching icons.
    void Icon.prefetch(activeIcon, inActiveIcon);
  }, [options]);

  const contentMemo = useMemo(
    () => (
      <DesktopTabItem
        onPress={options.tabbarOnPress ?? onPress}
        trackId={options.trackId}
        aria-current={isActive ? 'page' : undefined}
        selected={isActive}
        tabBarStyle={options.tabBarStyle}
        // @ts-expect-error
        icon={options?.tabBarIcon?.(isActive) as IKeyOfIcons}
        label={(options.tabBarLabel ?? '') as string}
      />
    ),
    [isActive, onPress, options],
  );

  return contentMemo;
}

function SideBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { routes } = state;
  const intl = useIntl();
  const tabs = useMemo(
    () =>
      routes.map((route, index) => {
        const focus = index === state.index;
        const { options } = descriptors[route.key];
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focus && !event.defaultPrevented) {
            navigation.dispatch({
              ...CommonActions.navigate({
                name: route.name,
                merge: true,
              }),
              target: state.key,
            });
          }
        };

        return (
          <TabItemView
            key={route.key}
            onPress={onPress}
            isActive={focus}
            options={options}
          />
        );
      }),
    [routes, state.index, state.key, descriptors, navigation],
  );

  const onLock = useOnLock();
  const handleLock = useCallback(async () => {
    await onLock();
  }, [onLock]);
  const { top } = useSafeAreaInsets();
  return (
    <YStack w={192} bg="$bg" pt={top} px="$3">
      <XStack h="$16" gap="$4" ai="center">
        <NavCloseButton />
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.global_settings })}
        </SizableText>
      </XStack>
      <SearchBar />
      <YStack flex={1} pt="$3">
        {tabs}
      </YStack>
      <TabItemView
        key="lock"
        onPress={handleLock}
        isActive={false}
        options={{
          tabBarIcon: () => 'LockOutline',
          title: intl.formatMessage({ id: ETranslations.settings_lock_now }),
        }}
      />
    </YStack>
  );
}

function SettingsTabNavigator() {
  const intl = useIntl();
  const tabScreens = TAB_CONFIGS.map(
    ({ icon, translationId, children, ...options }) => (
      <Tab.Screen
        key={translationId}
        name={translationId}
        options={{
          ...options,
          tabBarLabel: intl.formatMessage({ id: translationId }),
          tabBarIcon: () => icon,
          // @ts-expect-error BottomTabBar V7
          tabBarPosition: 'left',
        }}
      >
        {children}
      </Tab.Screen>
    ),
  );
  const tabBarCallback = useCallback(
    (props: BottomTabBarProps) => <SideBar {...props} />,
    [],
  );
  return (
    <Tab.Navigator
      tabBar={tabBarCallback}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        // Native Load all tabs at once
        // Web Lazy load
        lazy: !platformEnv.isNative,
      }}
    >
      {tabScreens}
    </Tab.Navigator>
  );
}

export default function SettingTab() {
  const { gtMd } = useMedia();
  const isTabNavigator = platformEnv.isNativeIOSPad || gtMd;
  return isTabNavigator ? <SettingsTabNavigator /> : null;
}
