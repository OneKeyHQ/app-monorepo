import React, { ComponentProps, FC, useCallback } from 'react';

import Input from '../Input';

type SearchbarProps = { value?: string; onChangeText?: (text: string) => void };

const Searchbar: FC<ComponentProps<typeof Input> & SearchbarProps> = ({
  value,
  onChangeText,
  ...props
}) => {
  const rightIconName = value ? 'CloseCircleSolid' : undefined;
  const onPressRightIcon = useCallback(() => {
    onChangeText?.('');
  }, [onChangeText]);
  return (
    <Input
      value={value}
      leftIconName="SearchOutline"
      rightIconName={rightIconName}
      placeholder="Search..."
      onPressRightIcon={onPressRightIcon}
      onChangeText={onChangeText}
      {...props}
    />
  );
};

export default Searchbar;
