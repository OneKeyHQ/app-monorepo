import { useCallback } from 'react';

import { Divider, Page, Stack, Switch, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  usePasswordPersistAtom,
  useSystemIdleLockSupport,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ListItemSelect } from '../../components/ListItemSelect';

import { useOptions } from './useOptions';

const EnableSystemIdleTimeItem = () => {
  const [{ enableSystemIdleLock }] = usePasswordPersistAtom();
  const [supportSystemIdle] = useSystemIdleLockSupport();
  return (
    <YStack>
      <Divider mx="$5" />
      <ListItem
        title="System Idle Lock"
        subtitle="Include system idle time for locking."
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
    </YStack>
  );
};

const AppAutoLock = () => {
  const [settings] = usePasswordPersistAtom();
  const onChange = useCallback(async (value: string) => {
    await backgroundApiProxy.servicePassword
      .setAppLockDuration(Number(value))
      .catch(() => console.log('failed to set app lock duration'));
  }, []);
  const options = useOptions();
  return (
    <Page>
      <Stack py="$2">
        <ListItemSelect
          onChange={onChange}
          value={String(settings.appLockDuration)}
          options={options}
        />
      </Stack>
      {platformEnv.isExtension || platformEnv.isDesktop ? (
        <EnableSystemIdleTimeItem />
      ) : null}
    </Page>
  );
};

export default AppAutoLock;
