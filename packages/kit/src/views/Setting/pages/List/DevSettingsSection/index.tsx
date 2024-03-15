import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Switch, YStack, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

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
      {GITHUB_SHA && (
        <SectionPressItem
          title={`BuildHash: ${GITHUB_SHA}`}
          onPress={() => {
            copyText(GITHUB_SHA);
          }}
        />
      )}
      <SectionFieldItem
        name="enableTestEndpoint"
        title={intl.formatMessage({ id: 'action__test_onekey_service' })}
      >
        <Switch size="small" />
      </SectionFieldItem>
      <SectionFieldItem
        name="showDevOverlayWindow"
        title="show dev overlay window"
      >
        <Switch size="small" />
      </SectionFieldItem>
      <SectionFieldItem
        name="enableCopyPasteInOnboardingPage"
        title="Show Copy/Paste In Onboarding Page"
      >
        <Switch size="small" />
      </SectionFieldItem>
      <SectionPressItem
        title="Clear App Data"
        onPress={() => {
          const dialog = Dialog.cancel({
            title: 'Clear App Data',
            renderContent: (
              <YStack>
                <SectionPressItem
                  title="Clear Dapp Data"
                  onPress={async () => {
                    await backgroundApiProxy.serviceDiscovery.clearDiscoveryPageData();
                    await dialog.close();
                  }}
                />
                <SectionPressItem
                  title="Clear Contracts Data"
                  onPress={async () => {
                    await backgroundApiProxy.serviceAddressBook.dangerClearDataForE2E();
                    await dialog.close();
                  }}
                />
                <SectionPressItem
                  title="Clear Wallets Data"
                  onPress={() => {
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
