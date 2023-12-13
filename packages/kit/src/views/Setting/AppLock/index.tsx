import { useCallback } from 'react';

import { Page, Stack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ListItemSelect } from '../Components/ListItemSelect';

import { useDurationOptions } from './useDurationOptions';

const AppLock = () => {
  const [settings] = useSettingsPersistAtom();
  const onChange = useCallback(async (value: string) => {
    await backgroundApiProxy.serviceSetting
      .setAppLockDuration(Number(value))
      .catch(() => console.log('failed to set app lock duration'));
  }, []);
  const options = useDurationOptions();
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
