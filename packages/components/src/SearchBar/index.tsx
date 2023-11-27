import { useCallback, useState } from 'react';

import { Input } from '../Input';

import type { IInputProps } from '../Input';

type ISearchBarProps = IInputProps;

export function SearchBar({
  value: defaultValue,
  onChangeText,
  ...rest
}: ISearchBarProps) {
  const [value, setValue] = useState(defaultValue ?? '');

  const handleChange = useCallback(
    (text: string) => {
      setValue(text);
      onChangeText?.(text);
    },
    [onChangeText],
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
          },
        ],
      })}
      {...rest}
    />
  );
}
