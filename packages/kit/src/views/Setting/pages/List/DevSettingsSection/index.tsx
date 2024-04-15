import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  ESwitchSize,
  Switch,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Section } from '../Section';

import { SectionFieldItem } from './SectionFieldItem';
import { SectionPressItem } from './SectionPressItem';
import { StartTimePanel } from './StartTimePanel';

const { GITHUB_SHA } = process.env;
export const DevSettingsSection = () => {
  const [settings] = useDevSettingsPersistAtom();
  const intl = useIntl();

  const { copyText } = useClipboard();
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
      title={intl.formatMessage({ id: 'form__dev_mode' })}
      titleProps={{ color: '$textCritical' }}
    >
      <SectionPressItem
        title="Disable the dev mode"
        onPress={handleDevModeOnChange}
      />
      {GITHUB_SHA ? (
        <SectionPressItem
          title={`BuildHash: ${GITHUB_SHA}`}
          onPress={() => {
            copyText(GITHUB_SHA);
          }}
        />
      ) : null}
      <SectionFieldItem
        name="enableTestEndpoint"
        title={intl.formatMessage({ id: 'action__test_onekey_service' })}
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
        title="show dev overlay window"
        testID="show-dev-overlay"
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>
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
        title="Startup Time"
        onPress={() => {
          Dialog.cancel({
            title: 'Startup Time(ms)',
            renderContent: <StartTimePanel />,
          });
        }}
      />
    </Section>
  );
};
