import { useCallback } from 'react';

import { random } from 'lodash';
import { useIntl } from 'react-intl';
import { I18nManager } from 'react-native';

import {
  Dialog,
  ESwitchSize,
  Input,
  Switch,
  Toast,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type { IDialogButtonProps } from '@onekeyhq/components/src/composite/Dialog/type';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Section } from '@onekeyhq/kit/src/components/Section';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { WebEmbedDevConfig } from '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/WebEmbed';
import {
  appUpdatePersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import appDeviceInfo from '@onekeyhq/shared/src/appDeviceInfo/appDeviceInfo';
import { EAppUpdateStatus } from '@onekeyhq/shared/src/appUpdate';
import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { isCorrectDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  ONEKEY_API_HOST,
  ONEKEY_TEST_API_HOST,
} from '@onekeyhq/shared/src/config/appConfig';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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

import { AddressBookDevSetting } from './AddressBookDevSetting';
import { AsyncStorageDevSettings } from './AsyncStorageDevSettings';
import { AutoJumpSetting } from './AutoJumpSetting';
import { AutoUpdateSection } from './AutoUpdateSection';
import { CrashDevSettings } from './CrashDevSettings';
import { HapticsPanel } from './HapticsPanel';
import { ImagePanel } from './ImagePanel';
import { NetInfo } from './NetInfo';
import { NotificationDevSettings } from './NotificationDevSettings';
import { SectionFieldItem } from './SectionFieldItem';
import { SectionPressItem } from './SectionPressItem';
import { SentryCrashSettings } from './SentryCrashSettings';

let correctDevOnlyPwd = '';

if (process.env.NODE_ENV !== 'production') {
  correctDevOnlyPwd = `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`;
}

const APP_VERSION = platformEnv.version ?? '1.0.0';

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

export const DevSettingsSection = () => {
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

  if (!devSettings.enabled) {
    return null;
  }

  return (
    <Section
      title={intl.formatMessage({ id: ETranslations.global_dev_mode })}
      titleProps={{ color: '$textCritical' }}
    >
      <SectionPressItem
        icon="PowerOutline"
        title="关闭开发者模式"
        onPress={handleDevModeOnChange}
      />
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
        </>
      ) : null}

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
        onValueChange={(enabled: boolean) => {
          if (platformEnv.isDesktop) {
            globalThis.desktopApi?.setAutoUpdateSettings?.({
              useTestFeedUrl: enabled,
            });
          }
          setTimeout(() => {
            void backgroundApiProxy.serviceApp.restartApp();
          }, 300);
        }}
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>
      {platformEnv.isWeb ? (
        <ListItem
          icon="SwitchHorOutline"
          drillIn
          onPress={() => {
            switchWebDappMode();
            globalThis.location.reload();
          }}
          title="Switch web mode"
          subtitle={`Current: ${isWebInDappMode() ? 'dapp' : 'wallet'} mode`}
          titleProps={{ color: '$textCritical' }}
        />
      ) : null}
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
      {platformEnv.isNative ? (
        <SectionFieldItem
          icon="BrowserOutline"
          name="webviewDebuggingEnabled"
          title="Enable WebviewDebugging"
          onValueChange={() => {
            setTimeout(() => {
              void backgroundApiProxy.serviceApp.restartApp();
            }, 300);
          }}
        >
          <Switch size={ESwitchSize.small} />
        </SectionFieldItem>
      ) : null}
      <SectionFieldItem
        icon="SolanaIllus"
        name="disableSolanaPriorityFee"
        title="禁用 Solana 交易优先费"
        subtitle={
          devSettings.settings?.disableSolanaPriorityFee ? '禁用' : '启用'
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
        icon="ApiConnectionOutline"
        name="disableWebEmbedApi"
        title="禁止 WebEmbedApi"
        subtitle="禁止 WebEmbedApi 渲染内置 Webview 网页"
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>
      <SectionFieldItem
        icon="LayoutWindowOutline"
        name="showDevOverlayWindow"
        title="开发者悬浮窗"
        subtitle="始终悬浮于全局的开发调试工具栏"
        testID="show-dev-overlay"
      >
        <Switch size={ESwitchSize.small} />
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
        icon="KeyOutline"
        name="showDevExportPrivateKey"
        title="首页导出私钥临时入口"
        subtitle=""
        testID="export-private-key"
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>
      <SectionFieldItem
        icon="ChromeBrand"
        name="showWebviewDevTools"
        title="开启 Webview 调试工具"
        subtitle=""
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>
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
      <SectionFieldItem
        icon="ShieldExclamationOutline"
        name="strictSignatureAlert"
        title="严格的签名 Alert 展示"
        subtitle="signTypedData 签名，红色 Alert"
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>
      <SectionFieldItem
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
      <SectionFieldItem
        icon="Layers2Outline"
        name="enableMarketV2"
        title="启用市场模块 V2 版本"
        subtitle={
          devSettings.settings?.enableMarketV2
            ? '使用新版本市场模块 (V2)'
            : '使用旧版本市场模块 (V1)'
        }
        onValueChange={() => {
          setTimeout(() => {
            void backgroundApiProxy.serviceApp.restartApp();
          }, 300);
        }}
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

      <AutoUpdateSection />

      <SectionFieldItem
        icon="WalletOutline"
        name="allowAddSameHDWallet"
        title="允许添加相同助记词 HD 钱包"
        subtitle=""
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

      <SectionPressItem
        icon="OnekeyDeviceCustom"
        title="FirmwareUpdateDevSettings"
        testID="firmware-update-dev-settings-menu"
        onPress={() => {
          navigation.push(EModalSettingRoutes.SettingDevFirmwareUpdateModal);
          // const dialog = Dialog.cancel({
          //   title: 'FirmwareUpdateDevSettings',
          //   renderContent: <FirmwareUpdateDevSettings />,
          // });
        }}
      />

      <SectionPressItem
        icon="Lab2Outline"
        title="Dev Unit Tests"
        testID="dev-unit-tests-menu"
        onPress={() => {
          navigation.push(EModalSettingRoutes.SettingDevUnitTestsModal);
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
              navigation.push(EModalSettingRoutes.SettingDevV4MigrationModal);
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
      <SectionPressItem
        icon="ServerOutline"
        title="Add ServerNetwork Test Data"
        subtitle="添加 ServerNetwork 测试数据"
        onPress={async () => {
          const currentNetworks =
            await backgroundApiProxy.simpleDb.serverNetwork.getAllServerNetworks();
          await backgroundApiProxy.simpleDb.serverNetwork.upsertServerNetworks({
            networkInfos: [
              ...(currentNetworks?.networks || []),
              {
                ...presetNetworksMap.eth,
                id: `evm--${random(100_000, 200_000)}`,
              },
            ],
          });
          Toast.success({
            title: 'success',
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
      <SectionPressItem
        icon="ForkOutline"
        title="Check Network info"
        onPress={() => {
          Dialog.confirm({
            renderContent: <NetInfo />,
          });
        }}
      />
      {platformEnv.isNativeAndroid ? (
        <SectionPressItem
          icon="PhoneOutline"
          copyable
          title={`Android Channel: ${process.env.ANDROID_CHANNEL || ''}`}
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
            title={`Desktop arch: ${globalThis?.desktopApi?.arch || ''}`}
          />
        </>
      ) : null}

      <AddressBookDevSetting />
      <SentryCrashSettings />
      <CrashDevSettings />

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
      <SectionPressItem
        icon="ChartTrendingOutline"
        title="PerpGallery"
        onPress={() => {
          navigation.push(EModalSettingRoutes.SettingDevPerpGalleryModal);
        }}
      />
      <AutoJumpSetting />

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

      <ListItem
        icon="PerformanceOutline"
        title="Performance Monitor(UI FPS/JS FPS)"
        subtitle="性能监控"
      >
        <Switch
          isUncontrolled
          size={ESwitchSize.small}
          defaultChecked={!!devSettings.settings?.showPerformanceMonitor}
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

      <SectionPressItem
        icon="AppleBrand"
        title="In-App-Purchase(Mac)"
        subtitle="设备信息"
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

      {platformEnv.isNativeAndroid ? (
        <SectionPressItem
          icon="BrowserOutline"
          title="check webview version"
          onPress={async () => {
            const webviewPackageInfo = await getCurrentWebViewPackageInfo();
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

      {platformEnv.isDesktop ? (
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
      ) : null}
    </Section>
  );
};
