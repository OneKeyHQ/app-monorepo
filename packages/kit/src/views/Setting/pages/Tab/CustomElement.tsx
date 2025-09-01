import { Suspense, useCallback, useContext, useMemo } from 'react';

import { upperFirst } from 'lodash';
import { useIntl } from 'react-intl';

import type {
  IIconProps,
  IKeyOfIcons,
  IPageNavigationProp,
  ISelectItem,
  ISizableTextProps,
} from '@onekeyhq/components';
import {
  ActionList,
  Badge,
  Dialog,
  ESwitchSize,
  IconButton,
  Select,
  SizableText,
  Switch,
  Toast,
  Tooltip,
  XStack,
  YStack,
  startViewTransition,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { UniversalContainerWithSuspense } from '@onekeyhq/kit/src/components/BiologyAuthComponent/container/UniversalContainer';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAppUpdateInfo } from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { TabFreezeOnBlurContext } from '@onekeyhq/kit/src/provider/Container/TabFreezeOnBlurContainer';
import {
  useAppUpdatePersistAtom,
  usePasswordBiologyAuthInfoAtom,
  usePasswordPersistAtom,
  usePasswordWebAuthInfoAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  GITHUB_URL,
  ONEKEY_URL,
  TWITTER_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import openUrlUtils, {
  openUrlExternal,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

import { useLocaleOptions, useResetApp } from '../../hooks';
import { handleOpenDevMode } from '../../utils/devMode';
import { useOptions } from '../AppAutoLock/useOptions';

import { TabSettingsListItem } from './ListItem';
import { useIsTabNavigator } from './useIsTabNavigator';

export interface ICustomElementProps {
  titleMatch?: IFuseResultMatch;
  title?: string;
  titleProps?: ISizableTextProps;
  iconProps?: IIconProps;
  icon?: IKeyOfIcons;
  onPress?: () => void;
}

export function CurrencyListItem(props: ICustomElementProps) {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingCurrencyModal);
  }, [navigation]);
  const [settings] = useSettingsPersistAtom();
  const text = settings.currencyInfo?.id ?? '';
  return (
    <TabSettingsListItem {...props} userSelect="none" drillIn onPress={onPress}>
      <ListItem.Text
        primaryTextProps={props?.titleProps}
        primary={text.toUpperCase()}
        align="right"
      />
    </TabSettingsListItem>
  );
}

export function LanguageListItem(props: ICustomElementProps) {
  const locales = useLocaleOptions();
  const [{ locale }] = useSettingsPersistAtom();

  // Fix issue where en-US is deprecated but still exists in user settings
  const options = useMemo(() => {
    return locales.filter((item) => item.value !== 'en-US');
  }, [locales]);
  const value = useMemo(() => {
    return locale === 'en-US' ? 'en' : locale;
  }, [locale]);
  const onChange = useCallback(async (text: string) => {
    await backgroundApiProxy.serviceSetting.setLocale(text as ILocaleSymbol);
    setTimeout(() => {
      if (platformEnv.isDesktop) {
        void globalThis.desktopApiProxy?.system?.changeLanguage?.(text);
      }
      void backgroundApiProxy.serviceApp.restartApp();
    }, 0);
  }, []);
  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={props?.title || ''}
      items={options}
      value={value}
      onChange={onChange}
      placement="bottom-end"
      floatingPanelProps={{ maxHeight: 280 }}
      sheetProps={{ snapPoints: [80], snapPointsMode: 'percent' }}
      renderTrigger={({ label }) => (
        <TabSettingsListItem {...props} userSelect="none">
          <XStack alignItems="center">
            <ListItem.Text
              primaryTextProps={props?.titleProps}
              primary={label}
              align="right"
            />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </TabSettingsListItem>
      )}
    />
  );
}

export function ThemeListItem(props: ICustomElementProps) {
  const [{ theme }] = useSettingsPersistAtom();
  const { setFreezeOnBlur } = useContext(TabFreezeOnBlurContext);
  const intl = useIntl();

  const options = useMemo<ISelectItem[]>(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.global_auto,
        }),
        description: intl.formatMessage({
          id: ETranslations.global_follow_the_system,
        }),
        value: 'system' as const,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_light }),
        value: 'light' as const,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_dark }),
        value: 'dark' as const,
      },
    ],
    [intl],
  );

  const onChange = useCallback(
    async (text: 'light' | 'dark' | 'system') => {
      setFreezeOnBlur(false);
      await backgroundApiProxy.serviceSetting.setTheme(text);
      setFreezeOnBlur(true);
    },
    [setFreezeOnBlur],
  );

  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={props?.title || ''}
      items={options}
      value={theme}
      onChange={onChange}
      placement="bottom-end"
      renderTrigger={({ label }) => (
        <TabSettingsListItem {...props} userSelect="none">
          <XStack alignItems="center">
            <ListItem.Text
              primaryTextProps={props?.titleProps}
              primary={label}
              align="right"
            />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </TabSettingsListItem>
      )}
    />
  );
}

function SuspenseBiologyAuthListItem(props: ICustomElementProps) {
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  const [{ isSupport: biologyAuthIsSupport }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();
  return isPasswordSet && (biologyAuthIsSupport || webAuthIsSupport) ? (
    <TabSettingsListItem {...props}>
      <UniversalContainerWithSuspense />
    </TabSettingsListItem>
  ) : null;
}

export function BiologyAuthListItem({
  titleMatch,
  title,
  icon,
  titleProps,
  iconProps,
}: ICustomElementProps) {
  return (
    <Suspense fallback={null}>
      <SuspenseBiologyAuthListItem
        titleMatch={titleMatch}
        title={title}
        icon={icon}
        titleProps={titleProps}
        iconProps={iconProps}
      />
    </Suspense>
  );
}

export function ClearAppCacheListItem(props: ICustomElementProps) {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingClearAppCache);
  }, [navigation]);
  return <TabSettingsListItem {...props} onPress={onPress} drillIn />;
}

export function CleanDataListItem(props: ICustomElementProps) {
  const intl = useIntl();
  const resetApp = useResetApp();
  return (
    <ActionList
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={props?.title || ''}
      renderTrigger={
        <TabSettingsListItem {...props} testID="setting-clear-data">
          <ListItem.DrillIn name="ChevronDownSmallOutline" />
        </TabSettingsListItem>
      }
      items={[
        {
          label: intl.formatMessage({
            id: ETranslations.settings_clear_pending_transactions,
          }),
          onPress: () => {
            Dialog.show({
              title: intl.formatMessage({
                id: ETranslations.settings_clear_pending_transactions,
              }),
              description: intl.formatMessage({
                id: ETranslations.settings_clear_pending_transactions_desc,
              }),
              tone: 'destructive',
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_clear,
              }),
              onConfirm: async () => {
                await backgroundApiProxy.serviceSetting.clearPendingTransaction();
                appEventBus.emit(
                  EAppEventBusNames.ClearLocalHistoryPendingTxs,
                  undefined,
                );
                Toast.success({
                  title: intl.formatMessage({
                    id: ETranslations.global_success,
                  }),
                });
              },
            });
          },
        },
        {
          label: intl.formatMessage({ id: ETranslations.settings_reset_app }),
          destructive: true,
          onPress: resetApp,
          testID: 'setting-erase-data',
        },
      ]}
    />
  );
}

export function HardwareTransportTypeListItem(props: ICustomElementProps) {
  const [{ hardwareTransportType }] = useSettingsPersistAtom();

  const transportOptions = useMemo(() => {
    if (platformEnv.isNative) {
      return [
        {
          label: 'Bluetooth',
          value: EHardwareTransportType.BLE,
        },
      ];
    }
    if (platformEnv.isDesktop) {
      if (platformEnv.isDesktopMac) {
        return [
          {
            label: 'Bridge',
            value: EHardwareTransportType.Bridge,
          },
          {
            label: 'Bluetooth',
            value: EHardwareTransportType.DesktopWebBle,
          },
        ];
      }
      return [
        {
          label: 'Bridge',
          value: EHardwareTransportType.Bridge,
        },
      ];
    }
    if (platformEnv.isSupportWebUSB) {
      return [
        {
          label: 'WebUSB',
          value: EHardwareTransportType.WEBUSB,
          iconProps: { name: 'UsbOutline' as const },
        },
        {
          label: 'Bridge',
          value: EHardwareTransportType.Bridge,
        },
      ];
    }
    return [];
  }, []);
  const onChange = useCallback(async (value: string) => {
    const newTransportType = value as EHardwareTransportType;

    if (platformEnv.isWeb || platformEnv.isExtension) {
      await backgroundApiProxy.serviceHardware.switchTransport({
        transportType: newTransportType,
      });
      await backgroundApiProxy.serviceSetting.setHardwareTransportType(
        newTransportType,
      );
    } else if (platformEnv.isDesktop) {
      // Desktop now supports runtime switching without restart
      await backgroundApiProxy.serviceHardware.switchHardwareTransportType({
        transportType: newTransportType,
      });
    }
  }, []);

  return (
    <Select
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={props?.title || ''}
      items={transportOptions}
      value={hardwareTransportType}
      onChange={onChange}
      placement="bottom-end"
      renderTrigger={({ label }) => (
        <TabSettingsListItem {...props} userSelect="none">
          <XStack alignItems="center">
            <ListItem.Text
              primaryTextProps={props?.titleProps}
              primary={label}
              align="right"
            />
            <ListItem.DrillIn ml="$1.5" name="ChevronDownSmallSolid" />
          </XStack>
        </TabSettingsListItem>
      )}
    />
  );
}

export function ListVersionItem(props: ICustomElementProps) {
  const { iconProps, titleProps } = props;
  const appUpdateInfo = useAppUpdateInfo();
  const handleToUpdatePreviewPage = useCallback(() => {
    appUpdateInfo.toUpdatePreviewPage();
  }, [appUpdateInfo]);
  return appUpdateInfo.isNeedUpdate ? (
    <TabSettingsListItem
      {...props}
      onPress={handleToUpdatePreviewPage}
      iconProps={{ ...iconProps, color: '$textInfo' }}
      titleProps={{ ...titleProps, color: '$textInfo' }}
      drillIn
    >
      <ListItem.Text
        primary={
          <Badge badgeType="info" badgeSize="lg">
            {appUpdateInfo.data.latestVersion}
          </Badge>
        }
        align="right"
      />
    </TabSettingsListItem>
  ) : (
    <TabSettingsListItem
      {...props}
      onPress={appUpdateInfo.onViewReleaseInfo}
      drillIn
    >
      <ListItem.Text
        primaryTextProps={props?.titleProps}
        primary={platformEnv.version}
        align="right"
      />
    </TabSettingsListItem>
  );
}

export function AutoLockListItem(props: ICustomElementProps) {
  const [{ isPasswordSet, appLockDuration }] = usePasswordPersistAtom();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingAppAutoLockModal);
  }, [navigation]);
  const options = useOptions();
  const text = useMemo(() => {
    const option = options.find(
      (item) => item.value === String(appLockDuration),
    );
    return option?.title ?? '';
  }, [options, appLockDuration]);
  return isPasswordSet ? (
    <TabSettingsListItem {...props} onPress={onPress} drillIn>
      <ListItem.Text
        primaryTextProps={props?.titleProps}
        primary={text}
        align="right"
      />
    </TabSettingsListItem>
  ) : null;
}

function SocialButton({
  icon,
  url,
  text,
  openInApp = false,
}: {
  icon: IKeyOfIcons;
  url: string;
  text: string;
  openInApp?: boolean;
}) {
  const isTabNavigator = useIsTabNavigator();
  const buttonSize = isTabNavigator ? undefined : '$14';
  const size = isTabNavigator ? '$5' : '$6';
  const onPress = useCallback(() => {
    if (openInApp) {
      openUrlUtils.openUrlInApp(url, text);
    } else {
      openUrlExternal(url);
    }
  }, [url, text, openInApp]);
  return (
    <Tooltip
      renderTrigger={
        <IconButton
          w={buttonSize}
          h={buttonSize}
          bg="$bgSubdued"
          icon={icon}
          iconSize={size as IIconProps['size']}
          borderRadius="$full"
          onPress={onPress}
        />
      }
      renderContent={text}
      placement="top"
    />
  );
}

// Special Support Button component that uses showIntercom
function SupportButton({ text }: { text: string }) {
  const isTabNavigator = useIsTabNavigator();
  const buttonSize = isTabNavigator ? undefined : '$14';
  const size = isTabNavigator ? '$5' : '$6';
  const onPress = useCallback(() => {
    // Then show intercom support
    void showIntercom();
  }, []);

  return (
    <Tooltip
      renderTrigger={
        <IconButton
          bg="$bgSubdued"
          w={buttonSize}
          h={buttonSize}
          iconSize={size as IIconProps['size']}
          icon="HelpSupportOutline"
          borderRadius="$full"
          onPress={onPress}
        />
      }
      renderContent={text}
      placement="top"
    />
  );
}

export function SocialButtonGroup() {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const isTabNavigator = useIsTabNavigator();
  const versionString = intl.formatMessage(
    {
      id: ETranslations.settings_version_versionnum,
    },
    {
      'versionNum': `${platformEnv.version ?? ''} ${
        platformEnv.buildNumber ?? ''
      }`,
    },
  );
  const handlePress = useCallback(() => {
    void handleOpenDevMode(() =>
      copyText(`${upperFirst(versionString)}-${platformEnv.githubSHA || ''}`),
    );
  }, [copyText, versionString]);
  const textSize = isTabNavigator ? '$bodySmMedium' : '$bodyMd';
  const textColor = isTabNavigator ? '$textDisabled' : '$textSubdued';
  return (
    <YStack pt="$3" pb="$4" gap={isTabNavigator ? '$2' : '$6'}>
      <XStack
        flex={platformEnv.isNative ? undefined : 1}
        jc={isTabNavigator ? 'flex-start' : 'center'}
        gap={isTabNavigator ? '$1.5' : '$3'}
      >
        <SocialButton
          icon="OnekeyBrand"
          url={ONEKEY_URL}
          text={intl.formatMessage({
            id: ETranslations.global_official_website,
          })}
        />
        <SocialButton
          icon="Xbrand"
          url={TWITTER_URL}
          text={intl.formatMessage({ id: ETranslations.global_x })}
        />
        <SocialButton
          icon="GithubBrand"
          url={GITHUB_URL}
          text={intl.formatMessage({ id: ETranslations.global_github })}
        />
        <SupportButton
          text={intl.formatMessage({
            id: ETranslations.settings_contact_us,
          })}
        />
      </XStack>
      <YStack
        jc="center"
        pl={isTabNavigator ? '$1' : '$4'}
        pr={isTabNavigator ? '0' : '$4'}
        ai={isTabNavigator ? 'flex-start' : 'center'}
        pt={platformEnv.isNativeIOSPad ? '$3' : undefined}
        userSelect="none"
        testID="setting-version"
      >
        <SizableText
          color={textColor}
          size={textSize}
          minWidth={platformEnv.isNativeAndroid ? 240 : undefined}
          textAlign={platformEnv.isNativeAndroid ? 'center' : undefined}
          numberOfLines={platformEnv.isNativeAndroid ? 1 : undefined}
          onPress={handlePress}
        >
          {upperFirst(versionString)}
        </SizableText>
        {!isTabNavigator &&
        (!appUpdateInfo.latestVersion ||
          appUpdateInfo.latestVersion === platformEnv.version) ? (
          <SizableText
            color={textColor}
            size={textSize}
            ai={isTabNavigator ? 'flex-start' : 'center'}
          >
            {intl.formatMessage({ id: ETranslations.update_app_up_to_date })}
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
}

export function DesktopBluetoothListItem(props: ICustomElementProps) {
  const [{ enableDesktopBluetooth }] = useSettingsPersistAtom();
  const toggleBluetooth = useCallback(async (value: boolean) => {
    startViewTransition(() => {
      void backgroundApiProxy.serviceSetting.setEnableDesktopBluetooth(value);
      defaultLogger.setting.page.settingsEnableBluetooth({ enabled: value });
    });
  }, []);
  return (
    <TabSettingsListItem {...props} userSelect="none">
      <Switch
        size={ESwitchSize.small}
        value={enableDesktopBluetooth}
        onChange={toggleBluetooth}
      />
    </TabSettingsListItem>
  );
}
