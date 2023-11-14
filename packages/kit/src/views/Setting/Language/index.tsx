import { ListItem, ModalContainer, Stack } from '@onekeyhq/components';

export default function SettingLanguageModal() {
  return (
    <ModalContainer>
      <Stack>
        <ListItem title="English">
          <ListItem.IconButton
            iconProps={{ 'color': '$iconActive' }}
            icon="CheckRadioSolid"
          />
        </ListItem>
        <ListItem title="简体中文" />
      </Stack>
    </ModalContainer>
  );
}
