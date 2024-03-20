import { useCallback, useState } from 'react';

import { Input } from '../../forms/Input';

import type { IInputProps } from '../../forms/Input';
import type {
  NativeSyntheticEvent,
  TextInputTextInputEventData,
} from 'react-native';

export type ISearchBarProps = IInputProps & {
  onSearchTextChange?: (text: string) => void;
};

const COMPOSITION_SPACE = String.fromCharCode(8198);

export function SearchBar({
  value: defaultValue,
  onChangeText,
  onSearchTextChange,
  ...rest
}: ISearchBarProps) {
  const [value, setValue] = useState(defaultValue ?? '');

  const handleChange = useCallback(
    (text: string) => {
      setValue(text);
      onChangeText?.(text);
      // This is a simple solution to support pinyin composition on iOS.
      // on Web should support CompositionStart event.
      onSearchTextChange?.(text.replaceAll(COMPOSITION_SPACE, ''));
    },
    [onChangeText, onSearchTextChange],
  );

  const handleClearValue = useCallback(() => {
    handleChange('');
  }, [handleChange]);

  return (
    <Input
      value={value}
      onChangeText={handleChange}
      leftIconName="SearchOutline"
      {...(value?.length && {
        addOns: [
          {
            iconName: 'XCircleOutline',
            onPress: handleClearValue,
            testID: `${rest.testID || ''}-clear`,
          },
        ],
      })}
      returnKeyType="search"
      returnKeyLabel="Search"
      {...rest}
    />
  );
}
