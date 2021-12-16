import React, { ComponentProps, FC, useCallback, useState } from 'react';

import Input from '../Input';

// type SearchbarProps = {};

const Searchbar: FC<ComponentProps<typeof Input>> = ({ ...props }) => {
  const [value, setValue] = useState('');
  const rightIconName = value ? 'CloseCircleSolid' : undefined;
  const onPressRightIcon = useCallback(() => {
    setValue('');
  }, []);
  return (
    <Input
      value={value}
      leftIconName="SearchOutline"
      rightIconName={rightIconName}
      placeholder="Search..."
      onPressRightIcon={onPressRightIcon}
      onChange={(e) => {
        setValue(e.nativeEvent.text);
      }}
      {...props}
    />
  );
};

export default Searchbar;
