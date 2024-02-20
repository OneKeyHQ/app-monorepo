import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Switch } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

import { Section } from '../Section';

export const DevSettingsSection = () => {
  const [settings] = useDevSettingsPersistAtom();
  const intl = useIntl();

  const handleDevModeOnChange = useCallback((isOpen: boolean) => {
    void backgroundApiProxy.serviceDevSetting.switchDevMode(isOpen);
  }, []);
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
      <ListItem
        title={intl.formatMessage({ id: 'action__test_onekey_service' })}
        titleProps={{ color: '$textCritical' }}
      >
        {/* <Switch
          size="small"
          value={settings.enableTestEndpoint}
          onChange={(value) =>
            handleDevModeOnChange({ enableTestEndpoint: value })
          }
        /> */}
      </ListItem>
    </Section>
  );
};
