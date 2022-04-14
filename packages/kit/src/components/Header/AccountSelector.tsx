/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, {
  FC,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useDrawerStatus } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';

import AccountSelectorDesktop from './AccountSelectorDesktop';
import AccountSelectorTrigger from './AccountSelectorTrigger';

type AccountSelectorProps = {
  renderTrigger?: ({
    visible,
    handleToggleVisible,
  }: {
    visible: boolean;
    handleToggleVisible: () => void;
  }) => ReactNode;
};

const AccountSelector: FC<AccountSelectorProps> = ({ renderTrigger }) => {
  const [innerVisible, setVisible] = useState(false);
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation();

  const isDrawerOpen = useDrawerStatus() === 'open';
  const triggerRef = useRef<HTMLElement>(null);
  const visible = isVerticalLayout ? isDrawerOpen : innerVisible;

  const handleToggleVisible = useCallback(() => {
    if (isVerticalLayout) {
      // @ts-expect-error
      navigation?.toggleDrawer?.();
    }
    setVisible((v) => !v);
  }, [navigation, isVerticalLayout]);

  const child = useMemo(() => {
    if (isVerticalLayout) {
      return null;
    }
    return (
      <AccountSelectorDesktop
        triggerEle={triggerRef?.current}
        visible={visible}
        toggleVisible={handleToggleVisible}
      />
    );
  }, [isVerticalLayout, visible, handleToggleVisible]);

  return (
    <Box
      ref={triggerRef}
      position="relative"
      alignItems="flex-start"
      h="56px"
      justifyContent="center"
      w="full"
    >
      {renderTrigger?.({ visible, handleToggleVisible }) ?? (
        <AccountSelectorTrigger
          visible={visible}
          handleToggleVisible={handleToggleVisible}
        />
      )}
      {child}
    </Box>
  );
};

export default AccountSelector;
