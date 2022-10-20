import React, {
  ComponentProps,
  ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { MotiView } from 'moti';
import { HStack, Pressable } from 'native-base';
import Collapsible from 'react-native-collapsible';
import { GestureResponderEvent } from 'react-native-modal/dist/types';

import { Box } from '@onekeyhq/components';

import Icon from '../Icon';

type CollapseProps = {
  trigger?: ReactNode;
  renderCustomTrigger?: (
    onPress: (event?: GestureResponderEvent) => void,
  ) => ReactNode;
  children: ReactNode;
  defaultCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
} & ComponentProps<typeof Box>;

const Collapse = ({
  trigger,
  renderCustomTrigger,
  children,
  onCollapseChange,
  defaultCollapsed = true,
  ...rest
}: CollapseProps) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggleCollapsed = useCallback(() => {
    const status = !collapsed;
    setCollapsed(status);
    onCollapseChange?.(status);
  }, [collapsed, onCollapseChange]);

  const triggerView = useMemo(() => {
    if (typeof renderCustomTrigger === 'function') {
      return renderCustomTrigger(toggleCollapsed);
    }
    return (
      <Pressable
        onPress={toggleCollapsed}
        p="8px"
        borderRadius="12px"
        _hover={{ bgColor: 'surface-hovered' }}
        _pressed={{ bgColor: 'surface-pressed' }}
      >
        <HStack alignItems="center">
          <MotiView
            from={{ rotate: '90deg' }}
            animate={{ rotate: collapsed ? '0deg' : '90deg' }}
          >
            <Icon name="ChevronRightSolid" size={20} />
          </MotiView>
          <Box ml="7px">{trigger}</Box>
        </HStack>
      </Pressable>
    );
  }, [trigger, renderCustomTrigger, collapsed, toggleCollapsed]);

  return (
    <>
      <Box {...rest}>
        {triggerView}
        <Collapsible collapsed={collapsed}>{children}</Collapsible>
      </Box>
    </>
  );
};

export default Collapse;
