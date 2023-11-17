import { useCallback } from 'react';

import { ModalContainer, ScrollView } from '@onekeyhq/components';
import type { ILocaleSymbol } from '@onekeyhq/components/src/locale';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ListItemSelect } from '../Components/ListItemSelect';
import { useLocaleOptions } from '../hooks';

export default function SettingLanguageModal() {
  const [settings] = useSettingsPersistAtom();
  const options = useLocaleOptions();
  const onChange = useCallback(async (text: string) => {
    await backgroundApiProxy.serviceSetting.setLocale(text as ILocaleSymbol);
  }, []);
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
