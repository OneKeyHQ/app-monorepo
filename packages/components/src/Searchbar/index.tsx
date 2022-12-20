import type { ComponentProps, FC } from 'react';
import { useCallback, useState } from 'react';

import Input from '../Input';

type SearchbarProps = {
  onClear?: () => void;
  onChangeText?: (text: string) => void;
};

const Searchbar: FC<
  Omit<ComponentProps<typeof Input>, 'onChange' | 'onChangeText'> &
    SearchbarProps
> = ({ value, onClear, onChangeText, ...props }) => {
  const [innerValue, setInnerValue] = useState(value);
  const rightIconName = innerValue || value ? 'XCircleMini' : undefined;
  const handleChangeText = useCallback(
    (text: string) => {
      if (typeof value === 'undefined') {
        setInnerValue(text);
      } else if (typeof onChangeText !== 'undefined') {
        onChangeText(text);
      }
    },
    [value, onChangeText],
  );

  return (
    <Input
      value={value ?? innerValue}
      leftIconName="SearchOutline"
      rightIconName={rightIconName}
      placeholder="Search..."
      onPressRightIcon={onClear}
      onChangeText={handleChangeText}
      {...props}
    />
  );
};

export default Searchbar;
