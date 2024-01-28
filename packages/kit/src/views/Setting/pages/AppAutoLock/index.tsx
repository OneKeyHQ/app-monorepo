import { useCallback } from 'react';

import { Page, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ListItemSelect } from '../../components/ListItemSelect';

import { useOptions } from './useOptions';

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
    </Page>
  );
};

export default AppAutoLock;
