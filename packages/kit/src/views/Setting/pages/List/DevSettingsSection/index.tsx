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
      title: 'Disable the dev mode',
      onConfirm: () => {
        void backgroundApiProxy.serviceDevSetting.switchDevMode(false);
      },
    });
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
        onValueChange={
          platformEnv.isDesktop
            ? (enabled: boolean) => {
                window.desktopApi?.setAutoUpdateSettings?.({
                  useTestFeedUrl: enabled,
                });
              }
            : undefined
        }
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
        title="Clear App Data"
        testID="clear-data-menu"
        onPress={() => {
          const dialog = Dialog.cancel({
            title: 'Clear App Data',
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
                  title="Clear Wallets Data"
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
              </YStack>
            ),
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
