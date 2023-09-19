import type { ComponentProps, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { MotiView } from 'moti';
import { HStack, Pressable } from 'native-base';
import Collapsible from 'react-native-collapsible';

import { Box } from '@onekeyhq/components';

import Icon from '../Icon';

type CollapseProps = {
  trigger?: ReactNode;
  renderCustomTrigger?: (onPress: () => void, collapsed?: boolean) => ReactNode;
  children: ReactNode;
  defaultCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  arrowPosition?: 'left' | 'right';
  triggerWrapperProps?: ComponentProps<typeof Pressable>;
  triggerProps?: ComponentProps<typeof Box>;
  value?: boolean;
} & ComponentProps<typeof Box>;

const Collapse = ({
  trigger,
  triggerProps,
  triggerWrapperProps,
  renderCustomTrigger,
  children,
  onCollapseChange,
  defaultCollapsed = true,
  arrowPosition = 'left',
  value,
  ...rest
}: CollapseProps) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (typeof value === 'boolean' && value !== collapsed) {
      setCollapsed(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const toggleCollapsed = useCallback(() => {
    const status = !collapsed;
    setCollapsed(status);
    onCollapseChange?.(status);
  }, [collapsed, onCollapseChange]);

  const triggerView = useMemo(() => {
    if (typeof renderCustomTrigger === 'function') {
      return renderCustomTrigger(toggleCollapsed, collapsed);
    }
    return (
      <Pressable
        onPress={toggleCollapsed}
        p="8px"
        borderRadius="12px"
        _hover={{ bgColor: 'surface-hovered' }}
        _pressed={{ bgColor: 'surface-pressed' }}
        {...triggerWrapperProps}
      >
        <HStack alignItems="center">
          {arrowPosition === 'right' && <Box {...triggerProps}>{trigger}</Box>}
          <MotiView animate={{ rotate: collapsed ? '0deg' : '90deg' }}>
            <Icon name="ChevronRightMini" size={20} color="icon-subdued" />
          </MotiView>
          {arrowPosition === 'left' && (
            <Box ml="7px" {...triggerProps}>
              {trigger}
            </Box>
          )}
        </HStack>
      </Pressable>
    );
  }, [
    renderCustomTrigger,
    toggleCollapsed,
    triggerWrapperProps,
    arrowPosition,
    triggerProps,
    trigger,
    collapsed,
  ]);

  return (
    <Box {...rest}>
      {triggerView}
      <Collapsible collapsed={collapsed}>{children}</Collapsible>
    </Box>
  );
};

export default Collapse;
