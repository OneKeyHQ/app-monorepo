import { useCallback } from 'react';

import { Page, Stack } from '@onekeyhq/components';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItemSelect } from '../../components/ListItemSelect';

import { useOptions } from './useOptions';

const AppLock = () => {
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

export default AppLock;
