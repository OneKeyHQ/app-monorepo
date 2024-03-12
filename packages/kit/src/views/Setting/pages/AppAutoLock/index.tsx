import { useCallback } from 'react';

import { Divider, Page, Stack, Switch, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  usePasswordPersistAtom,
  useSystemIdleLockSupport,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import { ListItemSelect } from '../../components/ListItemSelect';

import { useOptions } from './useOptions';

const EnableSystemIdleTimeItem = () => {
  const [{ enableSystemIdleLock }] = usePasswordPersistAtom();
  const [supportSystemIdle] = useSystemIdleLockSupport();

  return supportSystemIdle ? (
    <YStack>
      <Divider mx="$5" />
      <ListItem
        title="System Idle Lock"
        subtitle="Include system idle time for locking."
      >
        <Switch
          value={enableSystemIdleLock}
          onChange={async (checked) => {
            await backgroundApiProxy.servicePassword.setEnableSystemIdleLock(
              checked,
            );
          }}
        />
      </ListItem>
    </YStack>
  ) : null;
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
      <EnableSystemIdleTimeItem />
    </Page>
  );
};

export default AppAutoLock;
