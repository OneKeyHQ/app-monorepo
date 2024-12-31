import { useCallback } from 'react';

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
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { isCorrectDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  ONEKEY_API_HOST,
  ONEKEY_TEST_API_HOST,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  requestPermissionsAsync,
  setBadgeCountAsync,
} from '@onekeyhq/shared/src/modules3rdParty/expo-notifications';
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
import { CrashDevSettings } from './CrashDevSettings';
import { NetInfo } from './NetInfo';
import { NotificationDevSettings } from './NotificationDevSettings';
import { SectionFieldItem } from './SectionFieldItem';
import { SectionPressItem } from './SectionPressItem';
import { SentryCrashSettings } from './SentryCrashSettings';
import { StartTimePanel } from './StartTimePanel';

let correctDevOnlyPwd = '';

if (process.env.NODE_ENV !== 'production') {
  correctDevOnlyPwd = `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`;
}

function showDevOnlyPasswordDialog({
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
          globalThis?.desktopApi.changeDevTools(false);
        }
      },
    });
  }, []);

  const handleOpenDevTools = useCallback(() => {
    showDevOnlyPasswordDialog({
      title: 'Danger Zone: Open Chrome DevTools',
      onConfirm: async () => {
        globalThis?.desktopApi.changeDevTools(true);
      },
    });
  }, []);

  const forceIntoRTL = useCallback(() => {
    I18nManager.forceRTL(!I18nManager.isRTL);
    backgroundApiProxy.serviceApp.restartApp();
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
        title="关闭开发者模式"
        onPress={handleDevModeOnChange}
      />
      {platformEnv.isDesktop ? (
        <>
          <SectionPressItem
            title="Open Chrome DevTools in Desktop"
            subtitle="启用后可以使用快捷键 Cmd/Ctrl + Shift + I 开启调试工具"
            onPress={handleOpenDevTools}
          />
          <SectionPressItem
            title="Print Env Path in Desktop"
            subtitle="getEnvPath()"
            onPress={async () => {
              const envPath = globalThis?.desktopApi.getEnvPath();
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
        copyable
        title={settings.instanceId}
        subtitle="InstanceId"
      />
      {platformEnv.githubSHA ? (
        <SectionPressItem
          copyable
          title={platformEnv.githubSHA}
          subtitle="BuildHash"
        />
      ) : null}
      <SectionFieldItem
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
            backgroundApiProxy.serviceApp.restartApp();
          }, 300);
        }}
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>
      {platformEnv.isNative ? (
        <SectionFieldItem
          name="webviewDebuggingEnabled"
          title="Enable WebviewDebugging"
          onValueChange={() => {
            setTimeout(() => {
              backgroundApiProxy.serviceApp.restartApp();
            }, 300);
          }}
        >
          <Switch size={ESwitchSize.small} />
        </SectionFieldItem>
      ) : null}
      <SectionFieldItem
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
        name="disableNumberShortcuts"
        title="禁止数字快捷键"
        onValueChange={(value: boolean) => {
          globalThis.desktopApi.disableShortcuts({
            disableNumberShortcuts: value,
          });
          setTimeout(() => {
            backgroundApiProxy.serviceApp.restartApp();
          }, 300);
        }}
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>
      <SectionFieldItem
        name="disableSearchAndAccountSelectorShortcuts"
        title="禁止搜索及账户选择器快捷键"
        onValueChange={(value: boolean) => {
          globalThis.desktopApi.disableShortcuts({
            disableSearchAndAccountSelectorShortcuts: value,
          });
          setTimeout(() => {
            backgroundApiProxy.serviceApp.restartApp();
          }, 300);
        }}
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>
      <SectionFieldItem
        name="showDevOverlayWindow"
        title="开发者悬浮窗"
        subtitle="始终悬浮于全局的开发调试工具栏"
        testID="show-dev-overlay"
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>
      <SectionFieldItem
        name="alwaysSignOnlySendTx"
        title="始终只签名不广播"
        testID="always-sign-only-send-tx"
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>
      <SectionFieldItem
        name="showDevExportPrivateKey"
        title="首页导出私钥临时入口"
        subtitle=""
        testID="export-private-key"
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>

      <ListItem
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

      <SectionPressItem
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
        title="NotificationDevSettings"
        onPress={() => {
          const dialog = Dialog.cancel({
            title: 'NotificationDevSettings',
            renderContent: <NotificationDevSettings />,
          });
        }}
      />

      <SectionPressItem
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
                          backgroundApiProxy.serviceApp.restartApp();
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
        title="Startup Time(ms)"
        onPress={() => {
          Dialog.cancel({
            title: 'Startup Time(ms)',
            renderContent: <StartTimePanel />,
          });
        }}
      />
      <SectionPressItem
        title="Reset Spotlight"
        onPress={() => {
          void backgroundApiProxy.serviceSpotlight.reset();
        }}
      />
      <SectionPressItem
        title="Reset Hidden Sites in Floating icon"
        onPress={() => {
          void backgroundApiProxy.serviceSetting.clearFloatingIconHiddenSites();
        }}
      />
      <SectionPressItem
        title="Check Network info"
        onPress={() => {
          Dialog.confirm({
            renderContent: <NetInfo />,
          });
        }}
      />
      {platformEnv.isNativeAndroid ? (
        <SectionPressItem
          copyable
          title={`Android Channel: ${process.env.ANDROID_CHANNEL || ''}`}
        />
      ) : null}
      {platformEnv.isDesktop ? (
        <>
          <SectionPressItem
            copyable
            title={`Desktop Channel:${process.env.DESK_CHANNEL || ''} ${
              globalThis?.desktopApi?.channel || ''
            } ${globalThis?.desktopApi?.isMas ? 'mas' : ''}`}
          />
          <SectionPressItem
            copyable
            title={`Desktop arch: ${globalThis?.desktopApi?.arch || ''}`}
          />
        </>
      ) : null}

      {platformEnv.isWeb ? (
        <ListItem
          drillIn
          onPress={() => {
            switchWebDappMode();
            globalThis.location.reload();
          }}
          title={`Switch web mode: ${
            isWebInDappMode() ? 'dapp' : 'wallet'
          } mode`}
          titleProps={{ color: '$textCritical' }}
        />
      ) : null}

      <AddressBookDevSetting />
      <SentryCrashSettings />
      <CrashDevSettings />
    </Section>
  );
};
