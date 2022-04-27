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
import type { DesktopRef } from '@onekeyhq/components/src/Select/Container/Desktop';
import {
  addNewRef,
  removeOldRef,
} from '@onekeyhq/components/src/utils/SelectAutoHide';

import { setHaptics } from '../../hooks/setHaptics';

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

  const desktopRef = React.useRef<DesktopRef | null>(null);
  const setRef = React.useCallback((ref: DesktopRef | null) => {
    // Since we know there's a ref, we'll update `refs` to use it.
    if (ref) {
      // store the ref in this toast instance to be able to remove it from the array later when the ref becomes null.
      desktopRef.current = ref;
      addNewRef(ref);
    } else {
      // remove the this ref, wherever it is in the array.
      removeOldRef(desktopRef.current);
    }
  }, []);

  const child = useMemo(() => {
    if (isVerticalLayout) {
      return null;
    }
    return (
      <AccountSelectorDesktop
        ref={setRef}
        visible={visible}
        toggleVisible={handleToggleVisible}
      />
    );
  }, [isVerticalLayout, visible, handleToggleVisible, setRef]);

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
          handleToggleVisible={() => {
            setHaptics();
            if (!visible) {
              handleToggleVisible();
            }
          }}
        />
      )}
      {child}
    </Box>
  );
};

export default AccountSelector;
