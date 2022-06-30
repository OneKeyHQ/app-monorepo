import React from 'react';

import { Box, Icon, Pressable } from '@onekeyhq/components';

// TODO merge TxActionElementWithIcon & TxActionElementPressable
export function TxActionElementWithIcon(props: {
  children?: any;
  flex?: number;
  icon?: JSX.Element;
}) {
  const { children, flex, icon } = props;
  return (
    <Box flexDirection="row" alignItems="center">
      <Box flex={flex}>{children}</Box>
      {!!icon && <Box ml={1}>{icon}</Box>}
    </Box>
  );
}
export function TxActionElementPressable(props: {
  onPress?: (() => void) | null;
  children?: any;
}) {
  const { onPress, children } = props;
  const contentView = (
    <TxActionElementWithIcon
      flex={1}
      icon={onPress ? <Icon name="ChevronRightSolid" size={20} /> : undefined}
    >
      {children}
    </TxActionElementWithIcon>
  );
  if (onPress) {
    return <Pressable onPress={onPress}>{contentView}</Pressable>;
  }
  return contentView;
}
