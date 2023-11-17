import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ModalContainer, Stack } from '@onekeyhq/components';
import {
  type ISettingsPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  type IListItemSelectOption,
  ListItemSelect,
} from '../Components/ListItemSelect';

type IThemeValue = ISettingsPersistAtom['theme'];

export default function SettingThemeModal() {
  const [settings, setSettings] = useSettingsPersistAtom();
  const intl = useIntl();
  const options = useMemo<IListItemSelectOption<IThemeValue>[]>(
    () => [
      {
        title: intl.formatMessage({ id: 'form__auto' }),
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
    [],
  );
  const onChange = useCallback(
    (text: IThemeValue) => setSettings({ ...settings, 'theme': text }),
    [settings, setSettings],
  );
  return (
    <ModalContainer>
      <Stack>
        <ListItemSelect
          onChange={onChange}
          value={settings.theme}
          options={options}
        />
      </Stack>
    </ModalContainer>
  );
}
