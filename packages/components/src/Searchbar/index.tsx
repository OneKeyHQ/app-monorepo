import React, { ComponentProps, FC, useCallback, useState } from 'react';

import Input from '../Input';

type SearchbarProps = {
  onClear?: () => void;
  onChangeText?: (text: string) => void;
  hiddenLeftIcon?: boolean;
};

const Searchbar: FC<
  Omit<ComponentProps<typeof Input>, 'onChange' | 'onChangeText'> &
    SearchbarProps
> = ({ value, onClear, onChangeText, hiddenLeftIcon, ...props }) => {
  const [innerValue, setInnerValue] = useState(value);
  const rightIconName = innerValue || value ? 'CloseCircleSolid' : undefined;
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
      leftIconName={hiddenLeftIcon ? undefined : 'SearchOutline'}
      rightIconName={rightIconName}
      placeholder="Search..."
      onPressRightIcon={onClear}
      onChangeText={handleChangeText}
      {...props}
    />
  );
};

export default Searchbar;
