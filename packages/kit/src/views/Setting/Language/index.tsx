import { useCallback } from 'react';

import { ModalContainer, ScrollView } from '@onekeyhq/components';
import type { ILocaleSymbol } from '@onekeyhq/components/src/locale';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ListItemSelect } from '../Components/ListItemSelect';
import { useLocaleOptions } from '../hooks';

export default function SettingLanguageModal() {
  const [settings, setSettings] = useSettingsPersistAtom();
  const options = useLocaleOptions();
  const onChange = useCallback(
    (text: string) =>
      setSettings({ ...settings, 'locale': text as ILocaleSymbol }),
    [settings, setSettings],
  );
  return (
    <ModalContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ListItemSelect
          onChange={onChange}
          value={settings.locale}
          options={options.map((o) => ({ title: o.label, value: o.value }))}
        />
      </ScrollView>
    </ModalContainer>
  );
}
