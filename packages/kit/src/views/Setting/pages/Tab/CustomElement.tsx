import {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { CommonActions } from '@react-navigation/native';
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
  rootNavigationRef,
  startViewTransition,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { UniversalContainerWithSuspense } from '@onekeyhq/kit/src/components/BiologyAuthComponent/container/UniversalContainer';
import { useKeylessWallet } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import PasswordUpdateContainer from '@onekeyhq/kit/src/components/Password/container/PasswordUpdateContainer';
import {
  isShowAppUpdateUIWhenUpdating,
  useAppUpdateInfo,
} from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { TabFreezeOnBlurContext } from '@onekeyhq/kit/src/provider/Container/TabFreezeOnBlurContainer';
import {
  useAppUpdatePersistAtom,
  usePasswordBiologyAuthInfoAtom,
  usePasswordPersistAtom,
  usePasswordWebAuthInfoAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  displayAppUpdateVersion,
  encodeBundleVersionForDisplay,
} from '@onekeyhq/shared/src/appUpdate';
import {
  GITHUB_URL,
  ONEKEY_URL,
  TWITTER_FOLLOW_URL,
  TWITTER_FOLLOW_URL_CN,
} from '@onekeyhq/shared/src/config/appConfig';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EOnboardingV2OneKeyIDLoginMode } from '@onekeyhq/shared/src/routes/onboardingv2';
import openUrlUtils, {
  openUrlExternal,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { useLanguageSelector, useResetApp } from '../../hooks';
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
  const { options, value, onChange } = useLanguageSelector();
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

export function ClearPendingTransactionsListItem(props: ICustomElementProps) {
  const intl = useIntl();
  const onPress = useCallback(() => {
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
  }, [intl]);
  return <TabSettingsListItem {...props} onPress={onPress} drillIn />;
}

export function ResetAppListItem(props: ICustomElementProps) {
  const { iconProps, titleProps, ...restProps } = props;
  const resetApp = useResetApp();
  return (
    <TabSettingsListItem
      {...restProps}
      iconProps={{ ...iconProps, color: '$iconCritical' }}
      titleProps={{ ...titleProps, color: '$textCritical' }}
      onPress={resetApp}
      testID="setting-erase-data"
      drillIn
    />
  );
}

export function HardwareTransportTypeListItem(props: ICustomElementProps) {
  const [{ hardwareTransportType }] = useSettingsPersistAtom();
  const [devPersist] = useDevSettingsPersistAtom();

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
      const usb = devPersist?.settings?.usbCommunicationMode;
      const desktopTransportList: ISelectItem[] = [];
      if (usb === 'bridge') {
        desktopTransportList.push({
          label: 'Bridge',
          value: EHardwareTransportType.Bridge,
        });
      } else {
        desktopTransportList.push({
          label: 'WebUSB',
          value: EHardwareTransportType.WEBUSB,
        });
      }

      if (platformEnv.isSupportDesktopBle) {
        desktopTransportList.push({
          label: 'Bluetooth',
          value: EHardwareTransportType.DesktopWebBle,
        });
      }
      return desktopTransportList;
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
  }, [devPersist?.settings?.usbCommunicationMode]);
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
  const isShowAppUpdateUI = useMemo(() => {
    return isShowAppUpdateUIWhenUpdating({
      updateStrategy: appUpdateInfo.data.updateStrategy,
      updateStatus: appUpdateInfo.data.status,
    });
  }, [appUpdateInfo.data.updateStrategy, appUpdateInfo.data.status]);
  return isShowAppUpdateUI && appUpdateInfo.isNeedUpdate ? (
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
            {displayAppUpdateVersion(appUpdateInfo.data)}
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

export function ChangeOrSetPasswordListItem(props: ICustomElementProps) {
  const intl = useIntl();
  const [{ isPasswordSet }] = usePasswordPersistAtom();

  useEffect(() => {
    void backgroundApiProxy.servicePassword.checkPasswordSet();
  }, []);

  const onPress = useCallback(async () => {
    if (isPasswordSet) {
      const oldEncodedPassword =
        await backgroundApiProxy.servicePassword.promptPasswordVerify({
          reason: EReasonForNeedPassword.Security,
        });
      const dialog = Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.global_change_passcode,
        }),
        renderContent: (
          <PasswordUpdateContainer
            oldEncodedPassword={oldEncodedPassword.password}
            onUpdateRes={async (data) => {
              if (data) {
                await dialog.close();
              }
            }}
          />
        ),
        showFooter: false,
      });
    } else {
      void backgroundApiProxy.servicePassword.promptPasswordVerify();
    }
  }, [intl, isPasswordSet]);
  return <TabSettingsListItem {...props} onPress={onPress} drillIn />;
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
  const [{ locale }] = useSettingsPersistAtom();
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const [isSkipGpgVerificationAllowed, setIsSkipGpgVerificationAllowed] =
    useState(false);
  const isTabNavigator = useIsTabNavigator();

  useEffect(() => {
    let isMounted = true;
    void BundleUpdate.isSkipGpgVerificationAllowed()
      .then((allowed) => {
        if (isMounted) {
          setIsSkipGpgVerificationAllowed(Boolean(allowed));
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsSkipGpgVerificationAllowed(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const version = useMemo(() => {
    let bundleSuffix = '';
    if (isSkipGpgVerificationAllowed && platformEnv.bundleVersion) {
      bundleSuffix = `(${encodeBundleVersionForDisplay(platformEnv.bundleVersion)})`;
    }
    return `${platformEnv.version ?? ''} ${platformEnv.buildNumber ?? ''}${bundleSuffix}`;
  }, [isSkipGpgVerificationAllowed]);
  const versionString = intl.formatMessage(
    {
      id: ETranslations.settings_version_versionnum,
    },
    {
      'versionNum': version,
    },
  );
  const handleCopyVersion = useCallback(() => {
    void handleOpenDevMode(() =>
      copyText(
        `${upperFirst(versionString)}-${platformEnv.bundleVersion || ''}-${
          platformEnv.githubSHA || ''
        }`,
      ),
    );
  }, [copyText, versionString]);
  const textSize = isTabNavigator ? '$bodySmMedium' : '$bodyMd';
  const textColor = isTabNavigator ? '$textDisabled' : '$textSubdued';
  const isUpToDate = useMemo(() => {
    if (!appUpdateInfo.latestVersion) {
      return true;
    }
    if (appUpdateInfo.jsBundleVersion) {
      return (
        appUpdateInfo.latestVersion === platformEnv.version &&
        appUpdateInfo.jsBundleVersion === platformEnv.bundleVersion
      );
    }
    return appUpdateInfo.latestVersion === platformEnv.version;
  }, [appUpdateInfo.jsBundleVersion, appUpdateInfo.latestVersion]);
  const twitterFollowUrl = useMemo(() => {
    if (!locale) {
      return TWITTER_FOLLOW_URL;
    }
    return ['zh-CN', 'zh-HK', 'zh-TW'].includes(locale)
      ? TWITTER_FOLLOW_URL_CN
      : TWITTER_FOLLOW_URL;
  }, [locale]);
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
          url={twitterFollowUrl}
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
          onPress={handleCopyVersion}
        >
          {upperFirst(versionString)}
        </SizableText>
        {isSkipGpgVerificationAllowed ? (
          <XStack mt="$2" gap="$2" ai="center">
            <Badge badgeType="warning" badgeSize="lg">
              TEST
            </Badge>
            <Badge badgeType="critical" badgeSize="lg">
              SKIP GPG
            </Badge>
          </XStack>
        ) : null}
        {!isTabNavigator && isUpToDate ? (
          <SizableText
            color="$textDisabled"
            mt="$1"
            size={textSize}
            ai="center"
            textAlign="center"
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

export function BTCFreshAddressListItem(props: ICustomElementProps) {
  const [{ enableBTCFreshAddress }] = useSettingsPersistAtom();
  const toggleBTCFreshAddress = useCallback(async (value: boolean) => {
    startViewTransition(() => {
      void backgroundApiProxy.serviceSetting.setEnableBTCFreshAddress(value);
      defaultLogger.setting.page.settingsEnableBTCFreshAddress({
        enabled: value,
      });
    });
  }, []);
  return (
    <TabSettingsListItem {...props} userSelect="none">
      <Switch
        alignSelf="flex-start"
        size={ESwitchSize.small}
        value={enableBTCFreshAddress}
        onChange={toggleBTCFreshAddress}
      />
    </TabSettingsListItem>
  );
}

export function ResetPinListItem(props: ICustomElementProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { goToOneKeyIDLoginPageForKeylessWallet } = useKeylessWallet();

  const onPress = useCallback(async () => {
    try {
      // Always verify password before proceeding to reset PIN (Security reason forces re-entry)
      await backgroundApiProxy.servicePassword.promptPasswordVerify({
        reason: EReasonForNeedPassword.Security,
      });
      // Show loading only after password verification succeeds
      setIsLoading(true);
      // Reset navigation state to remove modal without triggering tab state change
      const state = rootNavigationRef.current?.getRootState();
      if (state) {
        const filteredRoutes = state.routes.filter(
          (route) => route.name !== ERootRoutes.Modal,
        );
        rootNavigationRef.current?.dispatch(
          CommonActions.reset({
            ...state,
            routes: filteredRoutes,
            index: filteredRoutes.length - 1,
          }),
        );
      }
      await goToOneKeyIDLoginPageForKeylessWallet({
        mode: EOnboardingV2OneKeyIDLoginMode.KeylessResetPin,
      });
    } catch {
      // User cancelled password verification, do nothing
    } finally {
      setIsLoading(false);
    }
  }, [goToOneKeyIDLoginPageForKeylessWallet]);

  return (
    <TabSettingsListItem
      {...props}
      minHeight="$12"
      onPress={onPress}
      isLoading={isLoading}
      drillIn
    />
  );
}
