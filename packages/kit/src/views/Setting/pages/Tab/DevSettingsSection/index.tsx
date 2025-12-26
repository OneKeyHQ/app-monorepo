import { useCallback } from 'react';
import type { ComponentProps } from 'react';

import { random } from 'lodash';
import { useIntl } from 'react-intl';
import { I18nManager } from 'react-native';

import {
  Accordion,
  Dialog,
  ESwitchSize,
  Icon,
  Input,
  Select,
  SizableText,
  Switch,
  TextAreaInput,
  Toast,
  View,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type { IDialogButtonProps } from '@onekeyhq/components/src/composite/Dialog/type';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Section } from '@onekeyhq/kit/src/components/Section';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { WebEmbedDevConfig } from '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/WebEmbed';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import appDeviceInfo from '@onekeyhq/shared/src/appDeviceInfo/appDeviceInfo';
import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { isCorrectDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  ONEKEY_API_HOST,
  ONEKEY_TEST_API_HOST,
} from '@onekeyhq/shared/src/config/appConfig';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  isDualScreenDevice,
  isRawSpanning,
  isSpanning,
} from '@onekeyhq/shared/src/modules/DualScreenInfo';
import LaunchOptionsManager from '@onekeyhq/shared/src/modules/LaunchOptionsManager';
import {
  requestPermissionsAsync,
  setBadgeCountAsync,
} from '@onekeyhq/shared/src/modules3rdParty/expo-notifications';
import {
  getCurrentWebViewPackageInfo,
  isGooglePlayServicesAvailable,
  openWebViewInGooglePlay,
} from '@onekeyhq/shared/src/modules3rdParty/webview-checker';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorage';
import {
  isBgApiSerializableCheckingDisabled,
  toggleBgApiSerializableChecking,
} from '@onekeyhq/shared/src/utils/assertUtils';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import {
  isWebInDappMode,
  switchWebDappMode,
} from '@onekeyhq/shared/src/utils/devModeUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EMessageTypesBtc } from '@onekeyhq/shared/types/message';

import { showApiEndpointDialog } from '../../../components/ApiEndpointDialog';

import { AddressBookDevSetting } from './AddressBookDevSetting';
import { AsyncStorageDevSettings } from './AsyncStorageDevSettings';
import { AutoJumpSetting } from './AutoJumpSetting';
import { CrashDevSettings } from './CrashDevSettings';
import { DeviceToken } from './DeviceToken';
import { HapticsPanel } from './HapticsPanel';
import { ImagePanel } from './ImagePanel';
import { NetInfo } from './NetInfo';
import { NotificationDevSettings } from './NotificationDevSettings';
import { RegistrationID } from './RegistrationID';
import { SectionFieldItem } from './SectionFieldItem';
import { SectionPressItem } from './SectionPressItem';
import { SentryCrashSettings } from './SentryCrashSettings';

let correctDevOnlyPwd = '';

if (process.env.NODE_ENV !== 'production') {
  correctDevOnlyPwd = `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`;
}

export function showDevOnlyPasswordDialog({
  title,
  description,
  onConfirm,
  confirmButtonProps,
}: {
  title: string;
  description?: string;
  onConfirm: (params: IBackgroundMethodWithDevOnlyPassword) => Promise<void>;
  confirmButtonProps?: IDialogButtonProps;
}) {
  Dialog.show({
    title,
    description,
    confirmButtonProps: {
      variant: 'destructive',
      ...confirmButtonProps,
    },
    renderContent: (
      <Dialog.Form formProps={{ values: { password: correctDevOnlyPwd } }}>
        <Dialog.FormField
          name="password"
          rules={{
            required: { value: true, message: 'password is required.' },
          }}
        >
          <Input testID="dev-only-password" placeholder="devOnlyPassword" />
        </Dialog.FormField>
      </Dialog.Form>
    ),
    onConfirm: async ({ getForm }) => {
      const form = getForm();
      if (form) {
        await form.trigger();
        const { password } = (form.getValues() || {}) as {
          password: string;
        };
        if (!isCorrectDevOnlyPassword(password)) {
          return;
        }
        const params: IBackgroundMethodWithDevOnlyPassword = {
          $$devOnlyPassword: password,
        };
        await onConfirm(params);
      }
    },
  });
}

const DevSettingsAccordionTrigger = ({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ComponentProps<typeof Icon>['name'];
}) => (
  <Accordion.Trigger
    bg="$bgSubdued"
    borderBottomWidth={0}
    // borderTopWidth={0}
    borderLeftWidth={0}
    borderRightWidth={0}
  >
    {({ open }: { open: boolean }) => (
      <YStack
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <YStack flexDirection="row" alignItems="center" gap="$3">
          {icon ? <Icon name={icon} color="$iconSubdued" /> : null}
          <YStack>
            <SizableText size="$bodyLgMedium">{title}</SizableText>
            {description || title ? (
              <SizableText textAlign="left" size="$bodyMd" color="$textSubdued">
                {description || title}
              </SizableText>
            ) : null}
          </YStack>
        </YStack>
        <View animation="quick" rotate={open ? '0deg' : '-90deg'}>
          <Icon name="ChevronDownSmallOutline" color="$iconSubdued" />
        </View>
      </YStack>
    )}
  </Accordion.Trigger>
);

const BaseDevSettingsSection = () => {
  const [settings] = useSettingsPersistAtom();
  const [devSettings] = useDevSettingsPersistAtom();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { copyText } = useClipboard();

  const handleDevModeOnChange = useCallback(() => {
    Dialog.show({
      title: '关闭开发者模式',
      onConfirm: () => {
        void backgroundApiProxy.serviceDevSetting.switchDevMode(false);
        if (platformEnv.isDesktop) {
          void globalThis?.desktopApiProxy?.dev?.changeDevTools(false);
        }
      },
    });
  }, []);

  const handleOpenDevTools = useCallback(() => {
    showDevOnlyPasswordDialog({
      title: 'Danger Zone: Open Chrome DevTools',
      onConfirm: async () => {
        void globalThis?.desktopApiProxy?.dev?.changeDevTools(true);
      },
    });
  }, []);

  const forceIntoRTL = useCallback(() => {
    I18nManager.forceRTL(!I18nManager.isRTL);
    void backgroundApiProxy.serviceApp.restartApp();
  }, []);

  const { activeAccount } = useActiveAccount({ num: 0 });

  const { navigationToMessageConfirmAsync } = useSignatureConfirm({
    accountId: activeAccount.account?.id ?? '',
    networkId: activeAccount.network?.id ?? '',
  });
  const handleSignMessage = useCallback(() => {
    Dialog.show({
      title: 'Sign Message',
      description: 'Sign Message',
      renderContent: (
        <Dialog.Form formProps={{ values: { message: '123' } }}>
          <Dialog.FormField
            name="message"
            rules={{
              required: { value: true, message: 'message is required.' },
            }}
          >
            <TextAreaInput placeholder="message" />
          </Dialog.FormField>
        </Dialog.Form>
      ),
      onConfirm: async ({ getForm, close }) => {
        const form = getForm();
        const unsignedMessage = form?.getValues()?.message;
        await close();
        const signedMessage = await navigationToMessageConfirmAsync({
          accountId: activeAccount.account?.id ?? '',
          networkId: activeAccount.network?.id ?? '',
          unsignedMessage: {
            type: EMessageTypesBtc.ECDSA,
            message: unsignedMessage,
            sigOptions: {
              noScriptType: true,
            },
            payload: {
              isFromDApp: false,
            },
          },
          walletInternalSign: true,
          sameModal: false,
          skipBackupCheck: true,
        });
        copyText(signedMessage);
        console.log(signedMessage);
        Dialog.show({
          title: 'Signed Message',
          description: signedMessage,
        });
      },
    });
  }, [
    activeAccount.account?.id,
    activeAccount.network?.id,
    copyText,
    navigationToMessageConfirmAsync,
  ]);

  if (!devSettings.enabled) {
    return null;
  }

  return (
    <Section
      title={intl.formatMessage({ id: ETranslations.global_dev_mode })}
      titleProps={{ color: '$textCritical' }}
    >
      <Accordion width="100%" type="multiple" defaultValue={['basic']}>
        <Accordion.Item value="basic">
          <DevSettingsAccordionTrigger
            title="Basic Info"
            description="基本信息"
            icon="InfoCircleOutline"
          />
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content animation="quick" exitStyle={{ opacity: 0 }}>
              <SectionPressItem
                icon="PowerOutline"
                title="关闭开发者模式"
                onPress={handleDevModeOnChange}
              />

              <SectionFieldItem
                icon="ServerOutline"
                name="enableTestEndpoint"
                title="启用 OneKey 测试网络节点"
                subtitle={
                  devSettings.settings?.enableTestEndpoint
                    ? ONEKEY_TEST_API_HOST
                    : ONEKEY_API_HOST
                }
                onBeforeValueChange={async () => {
                  try {
                    await backgroundApiProxy.serviceNotification.unregisterClient();
                  } catch (error) {
                    console.error(error);
                  }
                }}
                onValueChange={async (enabled: boolean) => {
                  if (platformEnv.isDesktop) {
                    await globalThis.desktopApiProxy?.appUpdate?.useTestUpdateFeedUrl?.(
                      enabled,
                    );
                  }
                  setTimeout(() => {
                    void backgroundApiProxy.serviceApp.restartApp();
                  }, 300);
                }}
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>
              <SectionPressItem
                icon="ApiConnectionOutline"
                title="API Endpoint Management"
                onPress={() => {
                  showApiEndpointDialog();
                }}
              />
              {platformEnv.isWeb ? (
                <ListItem
                  icon="SwitchHorOutline"
                  drillIn
                  onPress={() => {
                    switchWebDappMode();
                    globalThis.location.reload();
                  }}
                  title="Switch web mode"
                  subtitle={`Current: ${
                    isWebInDappMode() ? 'dapp' : 'wallet'
                  } mode`}
                  titleProps={{ color: '$textCritical' }}
                />
              ) : null}
              <AutoJumpSetting />
              <SectionPressItem
                icon="InfoCircleOutline"
                copyable
                title={settings.instanceId}
                subtitle="InstanceId"
              />

              {platformEnv.githubSHA ? (
                <SectionPressItem
                  icon="CodeOutline"
                  copyable
                  title={platformEnv.githubSHA}
                  subtitle="BuildHash"
                />
              ) : null}

              <SectionPressItem
                icon="CodeOutline"
                title="platformEnv"
                onPress={async () => {
                  const bundleStartTime =
                    typeof __BUNDLE_START_TIME__ !== 'undefined'
                      ? __BUNDLE_START_TIME__
                      : 0;
                  Dialog.debugMessage({
                    debugMessage: {
                      startupTimeAt:
                        await LaunchOptionsManager.getStartupTimeAt(),
                      jsReadyTimeAt:
                        await LaunchOptionsManager.getJSReadyTimeAt(),
                      uiVisibleTimeAt:
                        await LaunchOptionsManager.getUIVisibleTimeAt(),
                      jsReadyTime: await LaunchOptionsManager.getJSReadyTime(),
                      uiVisibleTime:
                        await LaunchOptionsManager.getUIVisibleTime(),
                      bundleStartTime:
                        await LaunchOptionsManager.getBundleStartTime(),
                      jsReadyFromPerformanceNow:
                        await LaunchOptionsManager.getJsReadyFromPerformanceNow(),
                      appWillMountFromPerformanceNow:
                        (globalThis.$$onekeyAppWillMountFromPerformanceNow ||
                          0) - bundleStartTime,
                      uiVisibleFromPerformanceNow:
                        await LaunchOptionsManager.getUIVisibleFromPerformanceNow(),
                      deskChannel: globalThis?.desktopApi?.deskChannel,
                      arch: globalThis?.desktopApi?.arch,
                      platform: globalThis?.desktopApi?.platform,
                      channel: globalThis?.desktopApi?.channel,
                      isMas: globalThis?.desktopApi?.isMas,
                      systemVersion: globalThis?.desktopApi?.systemVersion,
                      isDualScreenDevice: isDualScreenDevice(),
                      isRawSpanning: isRawSpanning(),
                      isSpanning: isSpanning(),
                      ...platformEnv,
                    },
                  });
                }}
              />
              <RegistrationID />
              <DeviceToken />
              {platformEnv.isDesktop ? (
                <>
                  <SectionPressItem
                    icon="ChromeBrand"
                    title="Open Chrome DevTools in Desktop"
                    subtitle="启用后可以使用快捷键 Cmd/Ctrl + Shift + I 开启调试工具"
                    onPress={handleOpenDevTools}
                  />
                  <SectionPressItem
                    icon="FolderOutline"
                    title="Print Env Path in Desktop"
                    subtitle="getEnvPath()"
                    onPress={async () => {
                      const envPath =
                        await globalThis?.desktopApiProxy?.system?.getEnvPath?.();
                      console.log(envPath);
                      Dialog.show({
                        title: 'getEnvPath',
                        description: JSON.stringify(envPath),
                      });
                    }}
                  />
                  <SectionFieldItem
                    icon="UsbOutline"
                    name="usbCommunicationMode"
                    title="USB 通信方式"
                  >
                    <Select
                      title="USB 通信方式"
                      items={[
                        { label: 'WebUSB', value: 'webusb' },
                        { label: 'Bridge', value: 'bridge' },
                      ]}
                      placement="bottom-end"
                    />
                  </SectionFieldItem>
                </>
              ) : null}

              <SectionPressItem
                icon="InfoCircleOutline"
                title="Device Info"
                subtitle="设备信息"
                onPress={async () => {
                  const deviceInfo = await appDeviceInfo.getDeviceInfo();
                  Dialog.debugMessage({
                    debugMessage: {
                      ...deviceInfo,
                      react_native_dsn: platformEnv.isNative
                        ? process.env.SENTRY_DSN_REACT_NATIVE
                        : '',
                    },
                  });
                }}
              />

              {platformEnv.isNativeAndroid ? (
                <SectionPressItem
                  icon="PhoneOutline"
                  copyable
                  title={`Android Channel: ${
                    process.env.ANDROID_CHANNEL || ''
                  }`}
                />
              ) : null}
              {platformEnv.isDesktop ? (
                <>
                  <SectionPressItem
                    icon="ComputerOutline"
                    copyable
                    title={`Desktop Channel:${process.env.DESK_CHANNEL || ''} ${
                      globalThis?.desktopApi?.channel || ''
                    } ${globalThis?.desktopApi?.isMas ? 'mas' : ''}`}
                  />
                  <SectionPressItem
                    icon="ProcessorOutline"
                    copyable
                    title={`Desktop arch: ${
                      globalThis?.desktopApi?.arch || ''
                    }`}
                  />
                </>
              ) : null}
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>

        <Accordion.Item value="devtools">
          <DevSettingsAccordionTrigger
            title="Dev Tools & Dev Settings"
            description="开发者工具，开发环境设置"
            icon="LabOutline"
          />
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content animation="quick" exitStyle={{ opacity: 0 }}>
              <SectionFieldItem
                icon="LayoutWindowOutline"
                name="showDevOverlayWindow"
                title="开发者悬浮窗"
                subtitle="始终悬浮于全局的开发调试工具栏"
                testID="show-dev-overlay"
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>

              <SectionPressItem
                icon="SwapHorOutline"
                title="force RTL"
                subtitle="强制启用 RTL 布局"
                drillIn={false}
              >
                <Switch
                  onChange={forceIntoRTL}
                  size={ESwitchSize.small}
                  value={I18nManager.isRTL}
                />
              </SectionPressItem>
              <SectionFieldItem
                icon="KeyboardUpOutline"
                name="disableAllShortcuts"
                title="禁止桌面快捷键"
                onValueChange={(value: boolean) => {
                  void globalThis.desktopApiProxy.system.disableShortcuts({
                    disableAllShortcuts: value,
                  });
                  setTimeout(() => {
                    void backgroundApiProxy.serviceApp.restartApp();
                  }, 300);
                }}
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>

              <SectionFieldItem
                icon="BrokenLinkOutline"
                name="disableIpTableInProd"
                title="[生产环境] 禁用 IP 直连"
                subtitle={
                  devSettings.settings?.disableIpTableInProd
                    ? '生产环境已禁用 IP 直连'
                    : '生产环境默认启用 (可手动禁用)'
                }
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>
              <SectionFieldItem
                icon="ArrowTopRightIllus"
                name="forceIpTableStrict"
                title="强制使用 IP 请求"
                subtitle={
                  devSettings.settings?.forceIpTableStrict
                    ? '强制使用 IP 请求'
                    : '非强制使用 IP 请求'
                }
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>
              <SectionPressItem
                icon="ForkOutline"
                title="Check Network info"
                onPress={() => {
                  Dialog.confirm({
                    renderContent: <NetInfo />,
                  });
                }}
              />

              <SectionPressItem
                icon="ArrowTopCircleOutline"
                title="Dev App Update Settings"
                onPress={() => {
                  navigation.push(EModalSettingRoutes.SettingDevAppUpdateModal);
                }}
              />

              <SectionPressItem
                icon="OnekeyDeviceCustom"
                title="FirmwareUpdateDevSettings"
                testID="firmware-update-dev-settings-menu"
                onPress={() => {
                  navigation.push(
                    EModalSettingRoutes.SettingDevFirmwareUpdateModal,
                  );
                }}
              />

              <SectionPressItem
                icon="BellOutline"
                title="NotificationDevSettings"
                onPress={() => {
                  Dialog.cancel({
                    title: 'NotificationDevSettings',
                    renderContent: <NotificationDevSettings />,
                  });
                }}
              />
              <SectionPressItem
                icon="StorageOutline"
                title="AsyncStorageDevSettings"
                onPress={() => {
                  Dialog.cancel({
                    title: 'Single data store test',
                    renderContent: <AsyncStorageDevSettings />,
                  });
                }}
              />
              {platformEnv.isNative ? (
                <SectionPressItem
                  icon="BagOutline"
                  title="AppNotificationBadge"
                  subtitle="设置应用图标角标"
                  testID="app-notification-badge-menu"
                  onPress={async () => {
                    const permissionsStatus = await requestPermissionsAsync({
                      ios: { allowBadge: true },
                    });
                    if (permissionsStatus.granted) {
                      const result = await setBadgeCountAsync(10);
                      console.log('result', result);
                    }
                  }}
                />
              ) : null}
              <SectionPressItem
                icon="AnimationOutline"
                title="V4MigrationDevSettings"
                testID="v4-migration-dev-settings-menu"
                onPress={() => {
                  Dialog.show({
                    title: '!!!!  Danger Zone: Clear all your data',
                    description:
                      'This is a feature specific to development environments. Function used to erase all data in the app.',
                    confirmButtonProps: {
                      variant: 'destructive',
                    },
                    onConfirm: () => {
                      navigation.push(
                        EModalSettingRoutes.SettingDevV4MigrationModal,
                      );
                    },
                  });
                }}
              />
              <SectionPressItem
                icon="TouchIdOutline"
                title="Haptics"
                onPress={() => {
                  Dialog.cancel({
                    title: 'Haptics',
                    renderContent: <HapticsPanel />,
                  });
                }}
              />
              <SectionPressItem
                icon="AiImagesOutline"
                title="Image"
                onPress={() => {
                  Dialog.cancel({
                    title: 'Image',
                    renderContent: <ImagePanel />,
                  });
                }}
              />
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>

        <Accordion.Item value="performance">
          <DevSettingsAccordionTrigger
            title="Performance & Crash & Error & Unit Tests"
            description="性能，崩溃，错误，单元测试"
            icon="ServerOutline"
          />
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content animation="quick" exitStyle={{ opacity: 0 }}>
              <ListItem
                icon="PerformanceOutline"
                title="Performance Monitor(UI FPS/JS FPS)"
                subtitle="性能监控"
              >
                <Switch
                  isUncontrolled
                  size={ESwitchSize.small}
                  defaultChecked={
                    !!devSettings.settings?.showPerformanceMonitor
                  }
                  onChange={(v) => {
                    void backgroundApiProxy.serviceDevSetting.updateDevSetting(
                      'showPerformanceMonitor',
                      v,
                    );
                    setTimeout(() => {
                      void backgroundApiProxy.serviceApp.restartApp();
                    }, 10);
                  }}
                />
              </ListItem>

              <ListItem
                icon="LightBulbOutline"
                title="DebugRenderTracker 组件渲染高亮"
                subtitle="启用后会导致 FlatList 无法滚动，仅供测试"
              >
                <Switch
                  isUncontrolled
                  size={ESwitchSize.small}
                  defaultChecked={
                    appStorage.syncStorage.getBoolean(
                      EAppSyncStorageKeys.onekey_debug_render_tracker,
                    ) ?? false
                  }
                  onChange={(v) => {
                    appStorage.syncStorage.set(
                      EAppSyncStorageKeys.onekey_debug_render_tracker,
                      v,
                    );
                  }}
                />
              </ListItem>

              <SectionFieldItem
                icon="CreditCardOutline"
                name="showPerpsRenderStats"
                title="显示 Perps 渲染统计"
                subtitle="显示 Perps 渲染统计"
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>

              <ListItem
                icon="LabOutline"
                title="Bg Api 可序列化检测"
                subtitle="启用后会影响性能, 仅在开发环境生效, 关闭 1 天后重新开启"
              >
                <Switch
                  isUncontrolled
                  size={ESwitchSize.small}
                  defaultChecked={!isBgApiSerializableCheckingDisabled()}
                  onChange={(v) => {
                    toggleBgApiSerializableChecking(v);
                  }}
                />
              </ListItem>

              <SectionFieldItem
                icon="ChartTrendingOutline"
                name="enableAnalyticsRequest"
                title="测试环境下发送 Analytics 请求"
                subtitle={
                  devSettings.settings?.enableAnalyticsRequest ? '开启' : '关闭'
                }
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>

              <SectionPressItem
                icon="Lab2Outline"
                title="Dev Unit Tests"
                testID="dev-unit-tests-menu"
                onPress={() => {
                  navigation.push(EModalSettingRoutes.SettingDevUnitTestsModal);
                }}
              />

              <SentryCrashSettings />
              <CrashDevSettings />
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>

        <Accordion.Item value="data">
          <DevSettingsAccordionTrigger
            title="Data Management"
            description="数据重置、清理、导出"
            icon="TableOutline"
          />
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content animation="quick" exitStyle={{ opacity: 0 }}>
              <SectionPressItem
                icon="BookmarkOutline"
                title="清空Market收藏数据"
                subtitle="清空所有Market页面的收藏/WatchList数据"
                onPress={() => {
                  Dialog.confirm({
                    title: '清空Market收藏数据',
                    description:
                      '确定要清空所有Market页面的收藏数据吗？此操作不可恢复。',
                    confirmButtonProps: { variant: 'destructive' },
                    onConfirm: async () => {
                      try {
                        await backgroundApiProxy.serviceMarketV2.clearAllMarketWatchListV2();
                        Toast.success({
                          title: '成功清空Market收藏数据',
                        });
                        setTimeout(() => {
                          void backgroundApiProxy.serviceApp.restartApp();
                        }, 1000);
                      } catch (error) {
                        Toast.error({
                          title: '清空失败',
                          message: String(error),
                        });
                      }
                    },
                  });
                }}
              />

              <SectionPressItem
                icon="DeleteOutline"
                title="Clear App Data (E2E release only)"
                testID="clear-data-menu"
                onPress={() => {
                  showDevOnlyPasswordDialog({
                    title: 'Danger Zone: Clear all your data',
                    confirmButtonProps: {
                      variant: 'destructive',
                      testID: 'clear-double-confirm',
                    },
                    description: `This is a feature specific to development environments.
                  Function used to erase all data in the app.`,
                    onConfirm: async (params) => {
                      Dialog.cancel({
                        title: 'Clear App Data (E2E release only)',
                        renderContent: (
                          <YStack>
                            <SectionPressItem
                              title="Clear Discovery Data"
                              testID="clear-discovery-data"
                              onPress={async () => {
                                await backgroundApiProxy.serviceE2E.clearDiscoveryPageData(
                                  params,
                                );
                                Toast.success({
                                  title: 'Success',
                                });
                              }}
                            />
                            <SectionPressItem
                              icon="Notebook3Outline"
                              title="Clear Address Book Data"
                              testID="clear-address-book-data"
                              onPress={async () => {
                                await backgroundApiProxy.serviceE2E.clearAddressBook(
                                  params,
                                );
                                Toast.success({
                                  title: 'Success',
                                });
                              }}
                            />
                            <SectionPressItem
                              title="Clear Wallets & Accounts Data"
                              testID="clear-wallets-data"
                              onPress={async () => {
                                await backgroundApiProxy.serviceE2E.clearWalletsAndAccounts(
                                  params,
                                );
                                if (platformEnv.isExtension) {
                                  await backgroundApiProxy.serviceApp.restartApp();
                                }
                                Toast.success({
                                  title: 'Success',
                                });
                              }}
                            />
                            <SectionPressItem
                              title="Clear Password"
                              testID="clear-password"
                              onPress={async () => {
                                await backgroundApiProxy.serviceE2E.clearPassword(
                                  params,
                                );
                                Toast.success({
                                  title: 'Success',
                                });
                              }}
                            />

                            <SectionPressItem
                              title="Clear History"
                              testID="clear-history"
                              onPress={async () => {
                                await backgroundApiProxy.serviceE2E.clearHistoryData(
                                  params,
                                );
                                Toast.success({
                                  title: 'Success',
                                });
                              }}
                            />

                            <SectionPressItem
                              title="Clear Settings"
                              testID="clear-settings"
                              onPress={async () => {
                                await backgroundApiProxy.serviceE2E.clearSettings(
                                  params,
                                );
                                Toast.success({
                                  title: 'Success',
                                });
                              }}
                            />

                            <SectionPressItem
                              title="Clear Wallet Connect Sessions"
                              testID="wallet-connect-session"
                              onPress={async () => {
                                await backgroundApiProxy.serviceWalletConnect.disconnectAllSessions();
                                Toast.success({
                                  title: 'Success',
                                });
                              }}
                            />
                          </YStack>
                        ),
                      });
                    },
                  });
                }}
              />
              <SectionPressItem
                icon="WalletOutline"
                title="Clear HD Wallet Hash and XFP"
                subtitle="清除所有钱包 hash 和 xfp"
                onPress={async () => {
                  await backgroundApiProxy.serviceAccount.clearAllWalletHashAndXfp();
                  Toast.success({
                    title: 'success',
                  });
                }}
              />
              <SectionPressItem
                icon="CalendarOutline"
                title="Clear Last DB Backup Timestamp"
                subtitle="清除最后一次 DB 备份时间戳"
                onPress={async () => {
                  await backgroundApiProxy.simpleDb.appStatus.clearLastDBBackupTimestamp();
                  Toast.success({
                    title: 'success',
                  });
                }}
              />
              <SectionPressItem
                icon="LockOutline"
                title="Clear Cached Password"
                subtitle="清除缓存密码"
                onPress={async () => {
                  await backgroundApiProxy.servicePassword.clearCachedPassword();
                  Toast.success({
                    title: 'Clear Cached Password Success',
                  });
                }}
              />
              <SectionPressItem
                icon="SearchOutline"
                title="Reset Spotlight"
                onPress={() => {
                  void backgroundApiProxy.serviceSpotlight.reset();
                }}
              />
              <SectionPressItem
                icon="PeopleOutline"
                title="Reset Invite Code"
                onPress={() => {
                  void backgroundApiProxy.serviceReferralCode.reset();
                }}
              />
              <SectionPressItem
                icon="EyeOffOutline"
                title="Reset Hidden Sites in Floating icon"
                onPress={() => {
                  void backgroundApiProxy.serviceSetting.clearFloatingIconHiddenSites();
                }}
              />
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>

        <Accordion.Item value="webview">
          <DevSettingsAccordionTrigger
            title="Webview & WebEmbed & TrandingView"
            description="Webview, WebEmbed, TrandingView"
            icon="BrowserOutline"
          />
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content animation="quick" exitStyle={{ opacity: 0 }}>
              <SectionPressItem
                icon="BrowserOutline"
                title="WebEmbedDevConfig"
                onPress={() => {
                  Dialog.cancel({
                    title: 'WebEmbedDevConfig',
                    renderContent: <WebEmbedDevConfig />,
                  });
                }}
              />
              <SectionFieldItem
                icon="ApiConnectionOutline"
                name="disableWebEmbedApi"
                title="禁止 WebEmbedApi"
                subtitle="禁止 WebEmbedApi 渲染内置 Webview 网页"
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>
              <SectionFieldItem
                icon="ChromeBrand"
                name="showWebviewDevTools"
                title="开启 Electron Webview 调试工具"
                subtitle=""
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>

              {platformEnv.isNative ? (
                <SectionFieldItem
                  icon="BrowserOutline"
                  name="webviewDebuggingEnabled"
                  title="Enable Native Webview Debugging"
                  onValueChange={() => {
                    setTimeout(() => {
                      void backgroundApiProxy.serviceApp.restartApp();
                    }, 300);
                  }}
                >
                  <Switch size={ESwitchSize.small} />
                </SectionFieldItem>
              ) : null}

              {platformEnv.isNativeAndroid ? (
                <SectionPressItem
                  icon="BrowserOutline"
                  title="check webview version"
                  onPress={async () => {
                    const webviewPackageInfo =
                      await getCurrentWebViewPackageInfo();
                    const googlePlayServicesStatus =
                      await isGooglePlayServicesAvailable();
                    Dialog.debugMessage({
                      debugMessage: {
                        webviewPackageInfo,
                        googlePlayServicesStatus,
                      },
                      onConfirmText: 'open in Google Play',
                      onConfirm: () => {
                        openWebViewInGooglePlay();
                      },
                    });
                  }}
                />
              ) : null}

              <SectionFieldItem
                icon="TradingViewCandlesOutline"
                name="useLocalTradingViewUrl"
                title="使用本地 TradingView URL"
                subtitle={
                  devSettings.settings?.useLocalTradingViewUrl
                    ? 'http://localhost:5173/'
                    : 'https://tradingview.onekeytest.com/'
                }
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>

        <Accordion.Item value="galleries">
          <DevSettingsAccordionTrigger
            title="UI Galleries"
            icon="AiImagesOutline"
          />
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content animation="quick" exitStyle={{ opacity: 0 }}>
              <SectionPressItem
                icon="LaptopOutline"
                title="DesktopApiProxy Test"
                subtitle="Test all DesktopApiProxy modules and methods"
                testID="desktop-api-proxy-test-menu"
                onPress={() => {
                  navigation.push(
                    EModalSettingRoutes.SettingDevDesktopApiProxyTestModal,
                  );
                }}
              />

              <SectionPressItem
                icon="ChartTrendingOutline"
                title="PerpGallery"
                onPress={() => {
                  navigation.push(
                    EModalSettingRoutes.SettingDevPerpGalleryModal,
                  );
                }}
              />

              <SectionPressItem
                icon="LockOutline"
                title="CryptoGallery"
                onPress={() => {
                  navigation.push(
                    EModalSettingRoutes.SettingDevCryptoGalleryModal,
                  );
                }}
              />
              <SectionPressItem
                icon="CloudOutline"
                title="CloudBackupGallery"
                onPress={() => {
                  navigation.push(
                    EModalSettingRoutes.SettingDevCloudBackupGalleryModal,
                  );
                }}
              />
              <SectionPressItem
                icon="PeopleOutline"
                title="AuthGallery"
                onPress={() => {
                  navigation.push(
                    EModalSettingRoutes.SettingDevAuthGalleryModal,
                  );
                }}
              />
              <SectionPressItem
                icon="KeyOutline"
                title="KeylessWalletGallery"
                onPress={() => {
                  navigation.push(
                    EModalSettingRoutes.SettingDevKeylessWalletGallery,
                  );
                }}
              />
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>

        <Accordion.Item value="account">
          <DevSettingsAccordionTrigger
            title="Account & Wallet & Prime & Network"
            description="账户，钱包，Prime，链和网络"
            icon="HeadOutline"
          />
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content animation="quick" exitStyle={{ opacity: 0 }}>
              <AddressBookDevSetting />

              <SectionFieldItem
                icon="WalletOutline"
                name="allowAddSameHDWallet"
                title="允许添加相同助记词 HD 钱包"
                subtitle=""
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>

              <SectionFieldItem
                icon="CloudOutline"
                name="isKeylessWalletFeatureEnabled"
                title="启用 Keyless Wallet"
                subtitle="启用无私钥钱包功能"
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>

              <SectionFieldItem
                icon="WalletOutline"
                name="allowCreateKeylessWalletOnWeb"
                title="允许网页端创建 Keyless 钱包"
                subtitle="在网页端 mock 云盘信息"
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>

              <SectionFieldItem
                icon="WalletOutline"
                name="allowDeleteKeylessKey"
                title="允许删除 Keyless Key"
                subtitle="允许删除 deviceKey 和 authKey"
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>

              <SectionPressItem
                icon="ServerOutline"
                title="Add ServerNetwork Test Data"
                subtitle="添加 ServerNetwork 测试数据"
                onPress={async () => {
                  const currentNetworks =
                    await backgroundApiProxy.simpleDb.serverNetwork.getAllServerNetworks();
                  await backgroundApiProxy.simpleDb.serverNetwork.upsertServerNetworks(
                    {
                      networkInfos: [
                        ...(currentNetworks?.networks || []),
                        {
                          ...presetNetworksMap.eth,
                          id: `evm--${random(100_000, 200_000)}`,
                        },
                      ],
                    },
                  );
                  Toast.success({
                    title: 'success',
                  });
                }}
              />

              <SectionFieldItem
                icon="PrimeOutline"
                name="showPrimeTest"
                title="开启 Prime"
                subtitle=""
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>
              <SectionFieldItem
                icon="CreditCardOutline"
                name="usePrimeSandboxPayment"
                title="开启 Prime Sandbox 付款"
                subtitle="需同时在服务器添加到 Sandbox 白名单后支付生效"
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>

              <SectionPressItem
                icon="AppleBrand"
                title="In-App-Purchase(Mac)"
                subtitle="查看 Mac 内购"
                onPress={async () => {
                  const products =
                    await globalThis.desktopApiProxy.inAppPurchase.getProducts({
                      productIDs: ['Prime_Yearly', 'Prime_Monthly'],
                    });
                  Dialog.debugMessage({
                    debugMessage: products,
                  });
                }}
              />

              <SectionFieldItem
                icon="KeyOutline"
                name="showDevExportPrivateKey"
                title="首页导出私钥临时入口"
                subtitle=""
                testID="export-private-key"
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>

              <SectionPressItem
                icon="UploadOutline"
                title="Export Accounts Data"
                onPress={() => {
                  showDevOnlyPasswordDialog({
                    title: 'Danger Zone',
                    description: `Export Accounts Data`,
                    onConfirm: async (params) => {
                      Dialog.cancel({
                        title: 'Export Accounts Data',
                        renderContent: (
                          <YStack>
                            <SectionPressItem
                              title="Export Accounts Data"
                              onPress={async () => {
                                const data =
                                  await backgroundApiProxy.serviceE2E.exportAllAccountsData(
                                    params,
                                  );
                                copyText(stableStringify(data));
                              }}
                            />
                          </YStack>
                        ),
                      });
                    },
                  });
                }}
              />
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>

        <Accordion.Item value="transaction">
          <DevSettingsAccordionTrigger
            title="Transaction & Signature"
            description="交易、签名"
            icon="SignatureOutline"
          />
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content animation="quick" exitStyle={{ opacity: 0 }}>
              <SectionPressItem
                icon="SignatureOutline"
                title="Sign Message"
                subtitle="Sign Message"
                onPress={handleSignMessage}
              />
              <SectionFieldItem
                icon="SolanaIllus"
                name="disableSolanaPriorityFee"
                title="禁用 Solana 交易优先费"
                subtitle={
                  devSettings.settings?.disableSolanaPriorityFee
                    ? '禁用'
                    : '启用'
                }
              >
                <Switch
                  size={ESwitchSize.small}
                  onChange={() => {
                    void backgroundApiProxy.serviceDevSetting.updateDevSetting(
                      'disableSolanaPriorityFee',
                      !devSettings.settings?.disableSolanaPriorityFee,
                    );
                  }}
                  value={devSettings.settings?.disableSolanaPriorityFee}
                />
              </SectionFieldItem>
              <SectionFieldItem
                icon="GasIllus"
                name="enableMockHighTxFee"
                title="模拟交易费过高"
                subtitle="强制交易费用检测判定为过高"
              >
                <Switch
                  size={ESwitchSize.small}
                  onChange={() => {
                    void backgroundApiProxy.serviceDevSetting.updateDevSetting(
                      'enableMockHighTxFee',
                      !devSettings.settings?.enableMockHighTxFee,
                    );
                  }}
                  value={devSettings.settings?.enableMockHighTxFee}
                />
              </SectionFieldItem>

              <SectionFieldItem
                icon="SignatureOutline"
                name="alwaysSignOnlySendTx"
                title="始终只签名不广播"
                testID="always-sign-only-send-tx"
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>
              <SectionFieldItem
                icon="ShieldExclamationOutline"
                name="strictSignatureAlert"
                title="严格的签名 Alert 展示"
                subtitle="signTypedData 签名，红色 Alert"
              >
                <Switch size={ESwitchSize.small} />
              </SectionFieldItem>
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>
      </Accordion>
    </Section>
  );
};

export const DevSettingsSection = () => {
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home }}
      enabledNum={[0]}
    >
      <BaseDevSettingsSection />
    </AccountSelectorProviderMirror>
  );
};
