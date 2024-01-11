import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Page, Stack } from '@onekeyhq/components';
import {
  type ISettingsPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  type IListItemSelectOption,
  ListItemSelect,
} from '../../components/ListItemSelect';

type IThemeValue = ISettingsPersistAtom['theme'];

export default function SettingThemeModal() {
  const [settings] = useSettingsPersistAtom();
  const intl = useIntl();
  const options = useMemo<IListItemSelectOption<IThemeValue>[]>(
    () => [
      {
        title: intl.formatMessage({ id: 'form__auto' }),
        subtitle: 'Follow the system',
        value: 'system' as const,
      },
      {
        title: intl.formatMessage({ id: 'form__light' }),
        value: 'light' as const,
      },
      {
        title: intl.formatMessage({ id: 'form__dark' }),
        value: 'dark' as const,
      },
    ],
    [intl],
  );
  const onChange = useCallback(
    async (text: IThemeValue) =>
      backgroundApiProxy.serviceSetting.setTheme(text),
    [],
  );
  return (
    <Page>
      <Stack py="$2">
        <ListItemSelect
          onChange={onChange}
          value={settings.theme}
          options={options}
        />
      </Stack>
    </Page>
  );
}
