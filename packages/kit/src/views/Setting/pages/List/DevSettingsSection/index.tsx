import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  ESwitchSize,
  Input,
  SizableText,
  Stack,
  Switch,
  Toast,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { isCorrectDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  ONEKEY_API_HOST,
  ONEKEY_TEST_API_HOST,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import {
  isWebInDappMode,
  switchWebDappMode,
} from '@onekeyhq/shared/src/utils/devModeUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

import { Section } from '../Section';

import { AddressBookDevSetting } from './AddressBookDevSetting';
import { SectionFieldItem } from './SectionFieldItem';
import { SectionPressItem } from './SectionPressItem';
import { StartTimePanel } from './StartTimePanel';

import { IDialogButtonProps } from '@onekeyhq/components/src/composite/Dialog/type';

let correctDevOnlyPwd = '';

if (process.env.NODE_ENV !== 'production') {
  correctDevOnlyPwd = `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`;
}

function showDevOnlyPasswordDialog({
  title,
  desc,
  onConfirm,
  confirmButtonProps,
}: {
  title: string;
  desc: string;
  onConfirm: (params: IBackgroundMethodWithDevOnlyPassword) => Promise<void>;
  confirmButtonProps?: IDialogButtonProps;
}) {
  let devOnlyPwd = correctDevOnlyPwd;
  Dialog.show({
    title,
    confirmButtonProps: {
      variant: 'destructive',
      ...confirmButtonProps,
    },
    renderContent: (
      <Stack>
        <SizableText>{desc}</SizableText>
        <Stack mt="$4">
          <Input
            testID="dev-only-password"
            placeholder="devOnlyPassword"
            defaultValue={correctDevOnlyPwd}
            onChangeText={(v) => {
              devOnlyPwd = v;
            }}
          />
        </Stack>
      </Stack>
    ),
    onConfirm: async () => {
      if (!isCorrectDevOnlyPassword(devOnlyPwd)) {
        return;
      }
      correctDevOnlyPwd = devOnlyPwd;
      const params: IBackgroundMethodWithDevOnlyPassword = {
        $$devOnlyPassword: devOnlyPwd,
      };
      await onConfirm(params);
    },
  });
}

export const DevSettingsSection = () => {
  const [settings] = useDevSettingsPersistAtom();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { copyText } = useClipboard();

  const handleDevModeOnChange = useCallback(() => {
    Dialog.show({
      title: '关闭开发者模式',
      onConfirm: () => {
        void backgroundApiProxy.serviceDevSetting.switchDevMode(false);
      },
    });
  }, []);

  const handleOpenDevTools = useCallback(() => {
    window?.desktopApi.openDevTools();
  }, []);

  if (!settings.enabled) {
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
            subtitle="重启后会使用快捷键 Cmd/Ctrl + Shift + I 开启调试工具"
            onPress={handleOpenDevTools}
          />
          <SectionPressItem
            title="Print Env Path in Desktop"
            subtitle="getEnvPath()"
            onPress={async () => {
              const envPath = window?.desktopApi.getEnvPath();
              console.log(envPath);
              Dialog.show({
                title: 'getEnvPath',
                description: JSON.stringify(envPath),
              });
            }}
          />
        </>
      ) : null}
      {platformEnv.githubSHA ? (
        <SectionPressItem
          copyable
          title={`BuildHash: ${platformEnv.githubSHA}`}
        />
      ) : null}
      <SectionFieldItem
        name="enableTestEndpoint"
        title="启用 OneKey 测试网络节点"
        subtitle={
          settings.settings?.enableTestEndpoint
            ? ONEKEY_TEST_API_HOST
            : ONEKEY_API_HOST
        }
        onValueChange={(enabled: boolean) => {
          if (platformEnv.isDesktop) {
            window.desktopApi?.setAutoUpdateSettings?.({
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
        testID="show-dev-overlay"
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>

      <SectionPressItem
        title="Export Accounts Data"
        onPress={() => {
          showDevOnlyPasswordDialog({
            title: 'Danger Zone',
            desc: `Export Accounts Data`,
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
            desc: `This is a feature specific to development environments.
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
        title="重置清空应用更新状态"
        onPress={() => {
          void backgroundApiProxy.serviceAppUpdate.reset();
        }}
      />
      <SectionPressItem
        title="重置清空应用更新状态为失败状态"
        onPress={() => {
          void backgroundApiProxy.serviceAppUpdate.notifyFailed();
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
              window?.desktopApi?.channel || ''
            } ${window?.desktopApi?.isMas ? 'mas' : ''}`}
          />
          <SectionPressItem
            copyable
            title={`Desktop arch: ${window?.desktopApi?.arch || ''}`}
          />
        </>
      ) : null}

      {platformEnv.isWeb ? (
        <ListItem
          drillIn
          onPress={() => {
            switchWebDappMode();
            window.location.reload();
          }}
          title={`Switch web mode: ${
            isWebInDappMode() ? 'dapp' : 'wallet'
          } mode`}
          titleProps={{ color: '$textCritical' }}
        />
      ) : null}

      <AddressBookDevSetting />
    </Section>
  );
};
