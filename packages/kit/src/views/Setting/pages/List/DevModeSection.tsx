import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListItem, Switch } from '@onekeyhq/components';
import type { ISettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { Section } from './Section';

export const DevModeSection = () => {
  const [settings] = useSettingsPersistAtom();
  const intl = useIntl();

  const handleDevModeOnChange = useCallback(
    (options: Partial<ISettingsPersistAtom['devMode']>) => {
      void backgroundApiProxy.serviceSetting.setDevMode(options);
    },
    [],
  );
  return (
    <Section
      title={intl.formatMessage({ id: 'form__dev_mode' })}
      titleProps={{ color: '$textCritical' }}
    >
      <ListItem
        title={intl.formatMessage({ id: 'form__dev_mode' })}
        titleProps={{ color: '$textCritical' }}
      >
        <Switch
          size="small"
          value={settings.devMode.enable}
          onChange={(value) => handleDevModeOnChange({ enable: value })}
        />
      </ListItem>
      <ListItem
        title={intl.formatMessage({ id: 'action__test_onekey_service' })}
        titleProps={{ color: '$textCritical' }}
      >
        <Switch
          size="small"
          value={settings.devMode.enableTestEndpoint}
          onChange={(value) =>
            handleDevModeOnChange({ enableTestEndpoint: value })
          }
        />
      </ListItem>
    </Section>
  );
};
