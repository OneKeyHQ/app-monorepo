import type { FC } from 'react';

import { ListItem, ModalContainer, Stack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

type IListItemCheckProps = {
  title: string;
  isChecked: boolean;
  onPress?: () => void;
};

const ListItemCheck: FC<IListItemCheckProps> = ({
  title,
  isChecked,
  onPress,
}) => (
  <ListItem title={title} onPress={onPress}>
    {isChecked ? (
      <ListItem.IconButton
        iconProps={{ 'color': '$iconActive' }}
        icon="CheckRadioSolid"
      />
    ) : null}
  </ListItem>
);

export default function SettingThemeModal() {
  const [settings, setSettings] = useSettingsPersistAtom();
  return (
    <ModalContainer>
      <Stack>
        <ListItemCheck
          title="Auto"
          isChecked={settings.theme === 'system'}
          onPress={() => {
            setSettings({ ...settings, 'theme': 'system' });
          }}
        />
        <ListItemCheck
          title="Light"
          isChecked={settings.theme === 'light'}
          onPress={() => {
            setSettings({ ...settings, 'theme': 'light' });
          }}
        />
        <ListItemCheck
          title="Dark"
          isChecked={settings.theme === 'dark'}
          onPress={() => {
            setSettings({ ...settings, 'theme': 'dark' });
          }}
        />
      </Stack>
    </ModalContainer>
  );
}
