import React, {
  ComponentProps,
  ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';

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
      <Pressable onPress={toggleCollapsed}>
        <HStack alignItems="center" {...rest}>
          <Icon
            name={collapsed ? 'ChevronRightSolid' : 'ChevronDownSolid'}
            size={20}
          />
          <Box ml="7px">{trigger}</Box>
        </HStack>
      </Pressable>
    );
  }, [trigger, renderCustomTrigger, collapsed, rest, toggleCollapsed]);

  return (
    <>
      {triggerView}
      <Collapsible collapsed={collapsed}>{children}</Collapsible>
    </>
  );
};

export default Collapse;
