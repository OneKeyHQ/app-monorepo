import { useCallback, useState } from 'react';

import { Input } from '../Input';

import type { IInputProps } from '../Input';

type ISearchBarProps = IInputProps;

export function SearchBar({ value, onChangeText, ...rest }: ISearchBarProps) {
  const [valueLength, setValueLength] = useState(value?.length ?? 0);

  const handleClearValue = useCallback(() => {
    onChangeText?.('');
    setValueLength(0);
  }, [onChangeText]);

  const handleChange = useCallback(
    (text: string) => {
      onChangeText?.(text);
      setValueLength(text.length);
    },
    [onChangeText],
  );

  return (
    <Input
      value={value}
      onChangeText={handleChange}
      leftIconName="SearchOutline"
      {...(valueLength && {
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
