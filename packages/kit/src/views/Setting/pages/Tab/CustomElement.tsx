import {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { CommonActions } from '@react-navigation/native';
import { upperFirst } from 'lodash';
import { useIntl } from 'react-intl';

import type {
  IIconProps,
  IKeyOfIcons,
  IPageNavigationProp,
  ISelectItem,
  ISizableTextProps,
  IXStackProps,
} from '@onekeyhq/components';
import {
  Badge,
  Dialog,
  ESwitchSize,
  Icon,
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
import {
  isShowAppUpdateUIWhenUpdating,
  useAppUpdateInfo,
} from '@onekeyhq/kit/src/components/AppUpdate';
import { UniversalContainerWithSuspense } from '@onekeyhq/kit/src/components/BiologyAuthComponent/container/UniversalContainer';
import { useKeylessWallet } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import PasswordUpdateContainer from '@onekeyhq/kit/src/components/Password/container/PasswordUpdateContainer';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { TabFreezeOnBlurContext } from '@onekeyhq/kit/src/provider/Container/TabFreezeOnBlurContainer';
import { openTravelModeSettingsWithAdmission } from '@onekeyhq/kit/src/utils/onboardingEntryGate';
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
  displayFullVersion,
} from '@onekeyhq/shared/src/appUpdate';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { ISettingsEntrySurface } from '@onekeyhq/shared/src/logger/scopes/setting';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EOnboardingV2OneKeyIDLoginMode } from '@onekeyhq/shared/src/routes/onboardingv2';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { useLanguageSelector, useResetApp } from '../../hooks';
import { SettingTestIDs } from '../../testIDs';
import { handleOpenDevMode } from '../../utils/devMode';
import { useOptions } from '../AppAutoLock/useOptions';

import { TabSettingsListItem } from './ListItem';
import { useOfficialChannels } from './officialChannels';
import {
  logSettingValueChanged,
  maybeLogSettingsSearchResultClick,
} from './settingsAnalytics';
import { useIsTabNavigator, useSettingsLayout } from './useIsTabNavigator';

export interface ICustomElementProps {
  titleMatch?: IFuseResultMatch;
  title?: string;
  subtitle?: ReactNode;
  titleProps?: ISizableTextProps;
  valueTextProps?: ISizableTextProps;
  iconProps?: IIconProps;
  icon?: IKeyOfIcons;
  testID?: string;
  onPress?: () => void;
  logItemClick?: () => void;
  analyticsSource?: ISettingsEntrySurface;
}

function useLogSearchResultOnSelectOpen({
  analyticsSource,
  logItemClick,
}: Pick<ICustomElementProps, 'analyticsSource' | 'logItemClick'>) {
  return useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        maybeLogSettingsSearchResultClick({
          source: analyticsSource,
          logItemClick,
        });
      }
    },
    [analyticsSource, logItemClick],
  );
}

export function CurrencyListItem({
  logItemClick,
  ...props
}: ICustomElementProps) {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    logItemClick?.();
    navigation.push(EModalSettingRoutes.SettingCurrencyModal);
  }, [logItemClick, navigation]);
  const [settings] = useSettingsPersistAtom();
  const text = settings.currencyInfo?.id ?? '';
  return (
    <TabSettingsListItem
      {...props}
      userSelect="none"
      drillIn
      onPress={onPress}
      testID={SettingTestIDs.currencyItem}
    >
      <ListItem.Text
        primaryTextProps={props?.valueTextProps ?? props?.titleProps}
        primary={text.toUpperCase()}
        align="right"
      />
    </TabSettingsListItem>
  );
}

export function LanguageListItem({
  logItemClick,
  analyticsSource,
  ...props
}: ICustomElementProps) {
  const { options, value, onChange } = useLanguageSelector();
  const handleChange = useCallback(
    (text: string) => {
      logSettingValueChanged({
        itemId: 'language',
        from: String(value),
        to: text,
      });
      void onChange(text);
    },
    [onChange, value],
  );
  const handleOpenChange = useLogSearchResultOnSelectOpen({
    analyticsSource,
    logItemClick,
  });
  return (
    <Select
      testID="setting-language-list-item-select"
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={props?.title || ''}
      items={options}
      value={value}
      onChange={handleChange}
      onOpenChange={handleOpenChange}
      placement="bottom-end"
      floatingPanelProps={{ maxHeight: 280 }}
      sheetProps={{ snapPoints: [80], snapPointsMode: 'percent' }}
      renderTrigger={({ label }) => (
        <TabSettingsListItem
          {...props}
          userSelect="none"
          testID={SettingTestIDs.languageItem}
        >
          <XStack alignItems="center">
            <ListItem.Text
              primaryTextProps={props?.valueTextProps ?? props?.titleProps}
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

export function ThemeListItem({
  logItemClick,
  analyticsSource,
  ...props
}: ICustomElementProps) {
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
      logSettingValueChanged({
        itemId: 'theme',
        from: theme,
        to: text,
      });
      setFreezeOnBlur(false);
      await backgroundApiProxy.serviceSetting.setTheme(text);
      setFreezeOnBlur(true);
    },
    [setFreezeOnBlur, theme],
  );
  const handleOpenChange = useLogSearchResultOnSelectOpen({
    analyticsSource,
    logItemClick,
  });

  return (
    <Select
      testID="setting-on-change-select"
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={props?.title || ''}
      items={options}
      value={theme}
      onChange={onChange}
      onOpenChange={handleOpenChange}
      placement="bottom-end"
      renderTrigger={({ label }) => (
        <TabSettingsListItem
          {...props}
          userSelect="none"
          testID={SettingTestIDs.themeItem}
        >
          <XStack alignItems="center">
            <ListItem.Text
              primaryTextProps={props?.valueTextProps ?? props?.titleProps}
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
  const shouldRender =
    isPasswordSet && (biologyAuthIsSupport || webAuthIsSupport);
  return shouldRender ? (
    <TabSettingsListItem {...props}>
      <UniversalContainerWithSuspense />
    </TabSettingsListItem>
  ) : null;
}

export function BiologyAuthListItem(props: ICustomElementProps) {
  return (
    <Suspense fallback={null}>
      <SuspenseBiologyAuthListItem {...props} />
    </Suspense>
  );
}

export function ClearAppCacheListItem({
  logItemClick,
  ...props
}: ICustomElementProps) {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    logItemClick?.();
    navigation.push(EModalSettingRoutes.SettingClearAppCache);
  }, [logItemClick, navigation]);
  return <TabSettingsListItem {...props} onPress={onPress} drillIn />;
}

export function ClearPendingTransactionsListItem({
  logItemClick,
  ...props
}: ICustomElementProps) {
  const intl = useIntl();
  const onPress = useCallback(() => {
    logItemClick?.();
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
  }, [intl, logItemClick]);
  return <TabSettingsListItem {...props} onPress={onPress} drillIn />;
}

export function ResetAppListItem(props: ICustomElementProps) {
  const { iconProps, titleProps, logItemClick, ...restProps } = props;
  const resetApp = useResetApp();
  const onPress = useCallback(() => {
    logItemClick?.();
    void resetApp();
  }, [logItemClick, resetApp]);
  return (
    <TabSettingsListItem
      {...restProps}
      iconProps={{ ...iconProps, color: '$iconCritical' }}
      titleProps={{ ...titleProps, color: '$textCritical' }}
      onPress={onPress}
      testID={SettingTestIDs.eraseDataButton}
      drillIn
    />
  );
}

export function HardwareTransportTypeListItem({
  logItemClick,
  analyticsSource,
  ...props
}: ICustomElementProps) {
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
      if (
        deviceUtils.getDesktopUsbTransportType({
          usbCommunicationMode: usb,
        }) === EHardwareTransportType.Bridge
      ) {
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
  const onChange = useCallback(
    async (value: string) => {
      logSettingValueChanged({
        itemId: 'hardware-communication',
        from: String(hardwareTransportType ?? ''),
        to: value,
      });
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
    },
    [hardwareTransportType],
  );
  const handleOpenChange = useLogSearchResultOnSelectOpen({
    analyticsSource,
    logItemClick,
  });

  return (
    <Select
      testID="setting-new-transport-type-select"
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={props?.title || ''}
      items={transportOptions}
      value={hardwareTransportType}
      onChange={onChange}
      onOpenChange={handleOpenChange}
      placement="bottom-end"
      renderTrigger={({ label }) => (
        <TabSettingsListItem {...props} userSelect="none">
          <XStack alignItems="center">
            <ListItem.Text
              primaryTextProps={props?.valueTextProps ?? props?.titleProps}
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
  const { iconProps, titleProps, logItemClick } = props;
  const { isMobileLayout } = useSettingsLayout();
  const appUpdateInfo = useAppUpdateInfo();
  const handleToUpdatePreviewPage = useCallback(() => {
    logItemClick?.();
    appUpdateInfo.toUpdatePreviewPage();
  }, [appUpdateInfo, logItemClick]);
  const handleViewReleaseInfo = useCallback(() => {
    logItemClick?.();
    appUpdateInfo.onViewReleaseInfo();
  }, [appUpdateInfo, logItemClick]);
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
      iconProps={{ ...iconProps, color: '$textSuccess' }}
      titleProps={{ ...titleProps, color: '$textSuccess' }}
      drillIn
    >
      <ListItem.Text
        primary={
          <Badge badgeType="success" badgeSize="lg">
            {displayAppUpdateVersion(appUpdateInfo.data)}
          </Badge>
        }
        align="right"
      />
    </TabSettingsListItem>
  ) : (
    <TabSettingsListItem {...props} onPress={handleViewReleaseInfo} drillIn>
      {isMobileLayout ? null : (
        <ListItem.Text
          primaryTextProps={props?.valueTextProps ?? props?.titleProps}
          primary={platformEnv.version}
          align="right"
        />
      )}
    </TabSettingsListItem>
  );
}

export function AutoLockListItem({
  logItemClick,
  ...props
}: ICustomElementProps) {
  const [{ isPasswordSet, appLockDuration }] = usePasswordPersistAtom();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    logItemClick?.();
    navigation.push(EModalSettingRoutes.SettingAppAutoLockModal);
  }, [logItemClick, navigation]);
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
        primaryTextProps={props?.valueTextProps ?? props?.titleProps}
        primary={text}
        align="right"
      />
    </TabSettingsListItem>
  ) : null;
}

export function ChangeOrSetPasswordListItem({
  logItemClick,
  ...props
}: ICustomElementProps) {
  const intl = useIntl();
  const [{ isPasswordSet }] = usePasswordPersistAtom();

  useEffect(() => {
    void backgroundApiProxy.servicePassword.checkPasswordSet();
  }, []);

  const onPress = useCallback(async () => {
    logItemClick?.();
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
  }, [intl, isPasswordSet, logItemClick]);
  return <TabSettingsListItem {...props} onPress={onPress} drillIn />;
}

function SocialButton({
  icon,
  url,
  text,
  testID,
}: {
  icon: IKeyOfIcons;
  url: string;
  text: string;
  testID?: string;
}) {
  const isTabNavigator = useIsTabNavigator();
  const buttonSize = isTabNavigator ? undefined : '$14';
  const size = isTabNavigator ? '$5' : '$6';
  const onPress = useCallback(() => {
    openUrlExternal(url);
  }, [url]);
  return (
    <Tooltip
      renderTrigger={
        <IconButton
          testID={testID}
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
          testID={SettingTestIDs.socialSupportBtn}
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

// Security-posture warning shown wherever the app version appears; keep the
// mobile root and desktop footer on one definition.
function SkipGpgBadges(props: IXStackProps) {
  return (
    <XStack gap="$2" alignItems="center" {...props}>
      <Badge badgeType="warning" badgeSize="lg">
        TEST
      </Badge>
      <Badge badgeType="critical" badgeSize="lg">
        SKIP GPG
      </Badge>
    </XStack>
  );
}

function useAppVersionDetails() {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const [isSkipGpgVerificationAllowed, setIsSkipGpgVerificationAllowed] =
    useState(false);

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
    return displayFullVersion(
      platformEnv.version,
      platformEnv.buildNumber,
      isSkipGpgVerificationAllowed ? platformEnv.bundleVersion : undefined,
    );
  }, [isSkipGpgVerificationAllowed]);
  const versionString = intl.formatMessage(
    {
      id: ETranslations.settings_version_versionnum,
    },
    {
      versionNum: version,
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
  const formattedVersion = upperFirst(versionString);
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

  return {
    copyVersionAccessibilityLabel: `${intl.formatMessage({
      id: ETranslations.global_copy,
    })}: ${formattedVersion}`,
    formattedVersion,
    handleCopyVersion,
    isSkipGpgVerificationAllowed,
    isUpToDate,
  };
}

export function MobileAboutHeader() {
  return (
    <YStack alignItems="center" pt="$6" pb="$5" userSelect="none">
      <Icon name="OnekeyBrand" size="$14" />
    </YStack>
  );
}

export function MobileSettingsVersionFooter() {
  const intl = useIntl();
  const {
    copyVersionAccessibilityLabel,
    formattedVersion,
    handleCopyVersion,
    isSkipGpgVerificationAllowed,
    isUpToDate,
  } = useAppVersionDetails();

  return (
    <YStack alignItems="center" mt="$1" pb="$2" userSelect="none">
      <YStack
        alignSelf="stretch"
        minHeight={44}
        px="$3"
        alignItems="center"
        justifyContent="center"
        pressStyle={{ opacity: 0.7 }}
        accessible
        accessibilityRole="button"
        accessibilityLabel={copyVersionAccessibilityLabel}
        testID={SettingTestIDs.versionItem}
        onPress={handleCopyVersion}
      >
        <SizableText
          color="$textSubdued"
          size="$bodyMd"
          textAlign="center"
          numberOfLines={2}
        >
          {formattedVersion}
        </SizableText>
      </YStack>
      {isSkipGpgVerificationAllowed ? <SkipGpgBadges mt="$1" /> : null}
      {isUpToDate ? (
        <SizableText
          color="$textDisabled"
          mt="$1"
          size="$bodySm"
          textAlign="center"
        >
          {intl.formatMessage({ id: ETranslations.update_app_up_to_date })}
        </SizableText>
      ) : null}
    </YStack>
  );
}

export function SocialButtonGroup() {
  const intl = useIntl();
  const officialChannels = useOfficialChannels();
  const {
    formattedVersion,
    handleCopyVersion,
    isSkipGpgVerificationAllowed,
    isUpToDate,
  } = useAppVersionDetails();
  const isTabNavigator = useIsTabNavigator();

  const textSize = isTabNavigator ? '$bodySmMedium' : '$bodyMd';
  const textColor = isTabNavigator ? '$textDisabled' : '$textSubdued';
  return (
    <YStack pt="$3" pb="$4" gap={isTabNavigator ? '$2' : '$6'}>
      <XStack
        flex={platformEnv.isNative ? undefined : 1}
        jc={isTabNavigator ? 'flex-start' : 'center'}
        gap={isTabNavigator ? '$1.5' : '$3'}
      >
        {officialChannels.map((channel) => (
          <SocialButton
            key={channel.id}
            icon={channel.icon}
            url={channel.url}
            text={channel.title}
            testID={channel.testID}
          />
        ))}
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
        testID={SettingTestIDs.versionItem}
      >
        <SizableText
          color={textColor}
          size={textSize}
          minWidth={platformEnv.isNativeAndroid ? 240 : undefined}
          textAlign={platformEnv.isNativeAndroid ? 'center' : undefined}
          numberOfLines={platformEnv.isNativeAndroid ? 1 : undefined}
          onPress={handleCopyVersion}
        >
          {formattedVersion}
        </SizableText>
        {isSkipGpgVerificationAllowed ? <SkipGpgBadges mt="$2" /> : null}
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

export function DesktopBluetoothListItem({
  logItemClick,
  analyticsSource,
  ...props
}: ICustomElementProps) {
  const [{ enableDesktopBluetooth }] = useSettingsPersistAtom();
  const toggleBluetooth = useCallback(
    async (value: boolean) => {
      maybeLogSettingsSearchResultClick({
        source: analyticsSource,
        logItemClick,
      });
      startViewTransition(() => {
        void backgroundApiProxy.serviceSetting.setEnableDesktopBluetooth(value);
        defaultLogger.setting.page.settingsEnableBluetooth({ enabled: value });
      });
    },
    [analyticsSource, logItemClick],
  );
  return (
    <TabSettingsListItem {...props} userSelect="none">
      <Switch
        testID="setting-toggle-bluetooth-switch"
        size={ESwitchSize.small}
        value={enableDesktopBluetooth}
        onChange={toggleBluetooth}
      />
    </TabSettingsListItem>
  );
}

export function MenuBarTrayListItem({
  logItemClick,
  analyticsSource,
  ...props
}: ICustomElementProps) {
  const [{ enableMenuBarTray }] = useSettingsPersistAtom();
  // Fall back to true so migrated users (persisted atom lacks this field)
  // match the main-process default of tray-enabled.
  const isEnabled = enableMenuBarTray ?? true;
  const toggleMenuBarTray = useCallback(
    async (value: boolean) => {
      maybeLogSettingsSearchResultClick({
        source: analyticsSource,
        logItemClick,
      });
      logSettingValueChanged({
        itemId: 'menu-bar-tray',
        from: String(isEnabled),
        to: String(value),
      });
      startViewTransition(() => {
        void backgroundApiProxy.serviceSetting.setEnableMenuBarTray(value);
        if (platformEnv.isDesktopMac) {
          globalThis.desktopApi?.toggleTray(value);
        }
      });
    },
    [analyticsSource, isEnabled, logItemClick],
  );
  return (
    <TabSettingsListItem {...props} userSelect="none">
      <Switch
        testID={SettingTestIDs.tabMenuBarTraySwitch}
        size={ESwitchSize.small}
        value={isEnabled}
        onChange={toggleMenuBarTray}
      />
    </TabSettingsListItem>
  );
}

export function HapticFeedbackListItem({
  logItemClick,
  analyticsSource,
  ...props
}: ICustomElementProps) {
  const [{ hapticFeedbackEnabled }] = useSettingsPersistAtom();
  const toggleHapticFeedback = useCallback(
    (value: boolean) => {
      maybeLogSettingsSearchResultClick({
        source: analyticsSource,
        logItemClick,
      });
      logSettingValueChanged({
        itemId: 'haptic-feedback',
        from: String(hapticFeedbackEnabled ?? true),
        to: String(value),
      });
      startViewTransition(() => {
        void backgroundApiProxy.serviceSetting.setHapticFeedbackEnabled(value);
      });
    },
    [analyticsSource, hapticFeedbackEnabled, logItemClick],
  );
  return (
    <TabSettingsListItem {...props} userSelect="none">
      <Switch
        testID={SettingTestIDs.tabHapticFeedbackSwitch}
        size={ESwitchSize.small}
        value={hapticFeedbackEnabled ?? true}
        onChange={toggleHapticFeedback}
      />
    </TabSettingsListItem>
  );
}

export function BTCFreshAddressListItem({
  logItemClick,
  analyticsSource,
  ...props
}: ICustomElementProps) {
  const [{ enableBTCFreshAddress }] = useSettingsPersistAtom();
  const toggleBTCFreshAddress = useCallback(
    async (value: boolean) => {
      maybeLogSettingsSearchResultClick({
        source: analyticsSource,
        logItemClick,
      });
      startViewTransition(() => {
        void backgroundApiProxy.serviceSetting.setEnableBTCFreshAddress(value);
        defaultLogger.setting.page.settingsEnableBTCFreshAddress({
          enabled: value,
        });
      });
    },
    [analyticsSource, logItemClick],
  );
  return (
    <TabSettingsListItem {...props} userSelect="none">
      <YStack alignSelf="stretch" justifyContent="center">
        <Switch
          testID="setting-toggle-b-t-c-fresh-address-switch"
          size={ESwitchSize.small}
          value={enableBTCFreshAddress}
          onChange={toggleBTCFreshAddress}
        />
      </YStack>
    </TabSettingsListItem>
  );
}

export function UseGasAccountByDefaultListItem({
  logItemClick,
  analyticsSource,
  ...props
}: ICustomElementProps) {
  const [{ useGasAccountByDefault }] = useSettingsPersistAtom();
  const toggleUseGasAccountByDefault = useCallback(
    async (value: boolean) => {
      maybeLogSettingsSearchResultClick({
        source: analyticsSource,
        logItemClick,
      });
      logSettingValueChanged({
        itemId: 'gas-account',
        from: String(useGasAccountByDefault ?? true),
        to: String(value),
      });
      startViewTransition(() => {
        void backgroundApiProxy.serviceSetting.setUseGasAccountByDefault(value);
      });
    },
    [analyticsSource, logItemClick, useGasAccountByDefault],
  );
  return (
    <TabSettingsListItem {...props} userSelect="none">
      <YStack alignSelf="stretch" justifyContent="center">
        <Switch
          testID={SettingTestIDs.tabUseGasAccountByDefaultSwitch}
          size={ESwitchSize.small}
          value={useGasAccountByDefault ?? true}
          onChange={toggleUseGasAccountByDefault}
        />
      </YStack>
    </TabSettingsListItem>
  );
}

export function SplitViewListItem({
  logItemClick,
  analyticsSource,
  ...props
}: ICustomElementProps) {
  const [{ enableSplitView }] = useSettingsPersistAtom();
  const checked = enableSplitView !== false;
  const toggleSplitView = useCallback(
    async (value: boolean) => {
      if (value === checked) return;
      maybeLogSettingsSearchResultClick({
        source: analyticsSource,
        logItemClick,
      });
      logSettingValueChanged({
        itemId: 'split-view',
        from: String(checked),
        to: String(value),
      });
      await backgroundApiProxy.serviceSetting.setEnableSplitView(value);
      // Layout swap requires a fresh app boot; small delay lets the Switch
      // animate before the native restart kicks in.
      setTimeout(() => {
        void backgroundApiProxy.serviceApp.restartApp();
      }, 200);
    },
    [analyticsSource, checked, logItemClick],
  );
  return (
    <TabSettingsListItem {...props} userSelect="none">
      <YStack alignSelf="stretch" justifyContent="center">
        <Switch
          testID={SettingTestIDs.tabSplitViewSwitch}
          size={ESwitchSize.small}
          value={checked}
          onChange={toggleSplitView}
        />
      </YStack>
    </TabSettingsListItem>
  );
}

export function ResetPinListItem({
  logItemClick,
  ...props
}: ICustomElementProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { goToOneKeyIDLoginPageForKeylessWallet } = useKeylessWallet();

  const onPress = useCallback(async () => {
    logItemClick?.();
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
  }, [goToOneKeyIDLoginPageForKeylessWallet, logItemClick]);

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

export function TravelModeListItem({
  logItemClick,
  ...props
}: ICustomElementProps) {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const [isLoading, setIsLoading] = useState(false);

  const onPress = useCallback(async () => {
    logItemClick?.();
    setIsLoading(true);
    try {
      await openTravelModeSettingsWithAdmission({
        openTravelModeSettings: ({ admissionId }) => {
          navigation.push(EModalSettingRoutes.SettingTravelModeModal, {
            admissionId,
          });
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [logItemClick, navigation]);

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
