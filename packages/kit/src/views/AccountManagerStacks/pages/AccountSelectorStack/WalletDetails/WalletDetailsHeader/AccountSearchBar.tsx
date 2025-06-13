import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { Button, InputUnControlled, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function AccountSearchBar({
  searchText,
  onSearchTextChange,
  editMode,
  onEditModeChange,
  editable,
}: {
  searchText: string;
  onSearchTextChange: (text: string) => void;
  editMode: boolean;
  onEditModeChange: (fn: (editMode: boolean) => boolean) => void;
  editable: boolean;
}) {
  const intl = useIntl();

  const handleSearch = useDebouncedCallback((text: string) => {
    onSearchTextChange(text?.trim() || '');
  }, 300);

  return (
    <XStack px="$5" py="$2" gap="$2">
      <InputUnControlled
        leftIconName="SearchOutline"
        size="small"
        allowClear
        placeholder={intl.formatMessage({
          id: ETranslations.global_search_account_selector,
        })}
        containerProps={{
          flex: 1,
          borderRadius: '$full',
          bg: '$bgStrong',
          borderColor: '$transparent',
        }}
        defaultValue={searchText}
        onChangeText={handleSearch}
      />
      {editable ? (
        <Button
          testID="account-edit-button"
          variant="tertiary"
          alignSelf="flex-start"
          $gtMd={{ top: '$0.5' }}
          onPress={() => {
            onEditModeChange((v) => !v);
          }}
          {...(editMode && {
            color: '$textInteractive',
            icon: 'CheckLargeOutline',
            iconColor: '$iconSuccess',
          })}
        >
          {editMode
            ? intl.formatMessage({ id: ETranslations.global_done })
            : intl.formatMessage({ id: ETranslations.global_edit })}
        </Button>
      ) : null}
    </XStack>
  );
}
