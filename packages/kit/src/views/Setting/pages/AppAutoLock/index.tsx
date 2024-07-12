import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Page,
  SizableText,
  Stack,
  Switch,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  usePasswordPersistAtom,
  useSystemIdleLockSupport,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ListItemSelect } from '../../components/ListItemSelect';

import { useOptions } from './useOptions';

const EnableSystemIdleTimeItem = () => {
  const intl = useIntl();
  const [{ enableSystemIdleLock }] = usePasswordPersistAtom();
  const [supportSystemIdle] = useSystemIdleLockSupport();
  return (
    <YStack>
      <Divider mx="$5" />
      <ListItem
        title={intl.formatMessage({
          id: ETranslations.settings_system_idle_lock,
        })}
      >
        <Switch
          disabled={!supportSystemIdle}
          value={supportSystemIdle ? enableSystemIdleLock : false}
          onChange={async (checked) => {
            await backgroundApiProxy.servicePassword.setEnableSystemIdleLock(
              checked,
            );
          }}
        />
      </ListItem>
      <Stack px="$5">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.settings_system_idle_lock_desc,
          })}
        </SizableText>
      </Stack>
    </YStack>
  );
};

const AutoLockDurationDescription = () => {
  const intl = useIntl();
  let text = intl.formatMessage({
    id: ETranslations.settings_set_auto_lock_duration_desktop,
  });
  if (platformEnv.isExtension) {
    text = intl.formatMessage({
      id: ETranslations.settings_set_auto_lock_duration_extension,
    });
  } else if (platformEnv.isWeb) {
    text = intl.formatMessage({
      id: ETranslations.settings_set_auto_lock_duration_web,
    });
  } else if (platformEnv.isNative) {
    text = intl.formatMessage({
      id: ETranslations.settings_set_auto_lock_duration_mobile,
    });
  }
  return (
    <Stack px="$5" pb="$5">
      <SizableText size="$bodySm" color="$textSubdued">
        {text}
      </SizableText>
    </Stack>
  );
};

const AppAutoLock = () => {
  const intl = useIntl();
  const [settings] = usePasswordPersistAtom();
  const onChange = useCallback(async (value: string) => {
    await backgroundApiProxy.servicePassword
      .setAppLockDuration(Number(value))
      .catch(() => console.log('failed to set app lock duration'));
  }, []);
  const options = useOptions();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.settings_auto_lock })}
      />
      <Page.Body>
        <Stack py="$2">
          <ListItemSelect
            onChange={onChange}
            value={String(settings.appLockDuration)}
            options={options}
          />
        </Stack>
        <AutoLockDurationDescription />
        {platformEnv.isExtension || platformEnv.isDesktop ? (
          <EnableSystemIdleTimeItem />
        ) : null}
      </Page.Body>
    </Page>
  );
};

export default AppAutoLock;
