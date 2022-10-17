import React, { ComponentProps, ReactNode, useCallback, useState } from 'react';

import { HStack, Pressable } from 'native-base';
import Collapsible from 'react-native-collapsible';

import { Box } from '@onekeyhq/components';

import Icon from '../Icon';

type CollapseProps = {
  trigger: ReactNode;
  children: ReactNode;
  defaultCollapsed?: boolean;
} & ComponentProps<typeof Box>;

const Collapse = ({
  trigger,
  children,
  defaultCollapsed = true,
  ...rest
}: CollapseProps) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed]);

  return (
    <>
      <Pressable onPress={toggleCollapsed}>
        <HStack alignItems="center" {...rest}>
          <Icon
            name={collapsed ? 'ChevronRightSolid' : 'ChevronDownSolid'}
            size={20}
          />
          <Box ml="7px">{trigger}</Box>
        </HStack>
      </Pressable>
      <Collapsible collapsed={collapsed}>{children}</Collapsible>
    </>
  );
};

export default Collapse;
