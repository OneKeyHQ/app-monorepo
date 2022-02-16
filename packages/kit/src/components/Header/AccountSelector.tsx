/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/core';
import { useDrawerStatus } from '@react-navigation/drawer';

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
  const [visible, setVisible] = useState(false);
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation();
  const isDrawerOpen = useDrawerStatus() === 'open';

  const handleToggleVisible = useCallback(() => {
    // @ts-expect-error
    if (isVerticalLayout) navigation?.toggleDrawer?.();
    setVisible((v) => !v);
  }, [navigation, isVerticalLayout]);

  useEffect(() => {
    setVisible(!!isDrawerOpen);
  }, [isDrawerOpen]);

  const child = useMemo(() => {
    if (isVerticalLayout) {
      return null;
    }
    return <AccountSelectorDesktop visible={visible} />;
  }, [visible, isVerticalLayout]);

  return (
    <Box
      position="relative"
      w={{ md: 'full' }}
      alignItems="center"
      h="56px"
      justifyContent="center"
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
