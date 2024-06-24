import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, ESwitchSize, Switch, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  ONEKEY_API_HOST,
  ONEKEY_TEST_API_HOST,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import {
  isWebInDappMode,
  switchWebDappMode,
} from '@onekeyhq/shared/src/utils/devModeUtils';

import { Section } from '../Section';

import { AddressBookDevSetting } from './AddressBookDevSetting';
import { SectionFieldItem } from './SectionFieldItem';
import { SectionPressItem } from './SectionPressItem';
import { StartTimePanel } from './StartTimePanel';

export const DevSettingsSection = () => {
  const [settings] = useDevSettingsPersistAtom();
  const intl = useIntl();
  const navigation = useAppNavigation();

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
        <SectionPressItem
          title="Open Chrome DevTools in Desktop"
          subtitle="重启后会在导航栏的菜单栏中出现相关按钮"
          onPress={handleOpenDevTools}
        />
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
          Dialog.show({
            title: '!!!!  Danger Zone: Clear all your data',
            description:
              'This is a feature specific to development environments. Function used to erase all data in the app.',
            confirmButtonProps: {
              variant: 'destructive',
            },
            onConfirm: () => {
              const dialog = Dialog.cancel({
                title: 'Clear App Data (E2E release only)',
                renderContent: (
                  <YStack>
                    <SectionPressItem
                      title="Clear Dapp Data"
                      testID="clear-dapp-data"
                      onPress={async () => {
                        await backgroundApiProxy.serviceE2E.clearDiscoveryPageData();
                        await dialog.close();
                      }}
                    />
                    <SectionPressItem
                      title="Clear Contacts Data"
                      testID="clear-contacts-data"
                      onPress={async () => {
                        await backgroundApiProxy.serviceE2E.dangerClearDataForE2E();
                        await dialog.close();
                      }}
                    />
                    <SectionPressItem
                      title="Clear Wallets & Accounts Data"
                      testID="clear-wallets-data"
                      onPress={async () => {
                        await backgroundApiProxy.serviceE2E.clearWalletsAndAccounts();
                        await dialog.close();
                      }}
                    />
                    <SectionPressItem
                      title="Clear Password"
                      testID="clear-password"
                      onPress={() => {
                        void backgroundApiProxy.serviceE2E.resetPasswordSetStatus();
                        void dialog.close();
                      }}
                    />
                    <SectionPressItem
                      title="Wallet Connect Session"
                      testID="wallet-connect-session"
                      onPress={() => {
                        void backgroundApiProxy.serviceWalletConnect.disconnectAllSessions();
                        void dialog.close();
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
