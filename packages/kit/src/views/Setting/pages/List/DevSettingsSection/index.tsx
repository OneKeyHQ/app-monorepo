import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Switch, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

import { Section } from '../Section';

import { SectionItem } from './SectionItem';

export const DevSettingsSection = () => {
  const [settings] = useDevSettingsPersistAtom();
  const intl = useIntl();

  const { copyText } = useClipboard();
  const handleDevModeOnChange = useCallback((isOpen: boolean) => {
    void backgroundApiProxy.serviceDevSetting.switchDevMode(isOpen);
  }, []);

  if (!settings.enabled) {
    return null;
  }

  return (
    <Section
      title={intl.formatMessage({ id: 'form__dev_mode' })}
      titleProps={{ color: '$textCritical' }}
    >
      <ListItem title="DevMode Switch" titleProps={{ color: '$textCritical' }}>
        <Switch
          size="small"
          value={settings.enabled}
          onChange={handleDevModeOnChange}
        />
      </ListItem>
      <SectionItem title="Build Hash">
        <SizableText
          onPress={() => {
            if (process.env.GITHUB_SHA) {
              copyText(process.env.GITHUB_SHA);
            }
          }}
        >
          {process.env.GITHUB_SHA ? process.env.GITHUB_SHA : '--'}
        </SizableText>
      </SectionItem>
      <SectionItem
        name="enableTestEndpoint"
        title={intl.formatMessage({ id: 'action__test_onekey_service' })}
      >
        <Switch size="small" />
      </SectionItem>
      <SectionItem
        name="enableCopyPasteInOnboardingPage"
        title="Show Copy/Paste In Onboarding Page"
      >
        <Switch size="small" />
      </SectionItem>
      <SectionItem title="Clear App Data">
        <Switch size="small" />
      </SectionItem>
    </Section>
  );
};
