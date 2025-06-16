import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import { InputUnControlled, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function AccountSearchBar({
  searchText,
  onSearchTextChange,
}: {
  searchText: string;
  onSearchTextChange: (text: string) => void;
}) {
  const intl = useIntl();

  const handleSearch = useDebouncedCallback((text: string) => {
    onSearchTextChange(text?.trim() || '');
  }, 300);

  return (
    <XStack
      mb="$2"
      px="$5"
      py="$2"
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="$neutral3"
    >
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
    </XStack>
  );
}
