/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { FC, ReactNode } from 'react';
import { memo, useCallback, useMemo, useRef } from 'react';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import type { DesktopRef } from '@onekeyhq/components/src/Select/Container/Desktop';
import {
  addNewRef,
  removeOldRef,
} from '@onekeyhq/components/src/utils/SelectAutoHide';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigationActions } from '../../../hooks';
import { useCloseOnEsc } from '../../../hooks/useOnKeydown';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';
import { useWalletSelectorStatus } from '../hooks/useWalletSelectorStatus';
import WalletSelectorDesktop from '../WalletSelectorDesktop';

import { WalletSelectorTriggerElement } from './WalletSelectorTriggerElement';

import type { WalletSelectorTriggerElementProps } from './WalletSelectorTriggerElement';

type AccountSelectorProps = {
  renderTrigger?: ({
    visible,
    handleToggleVisible,
  }: {
    visible: boolean;
    handleToggleVisible: () => void;
  }) => ReactNode;
};

const { updateDesktopWalletSelectorVisible } = reducerAccountSelector.actions;

const WalletSelectorTrigger: FC<
  AccountSelectorProps & Partial<WalletSelectorTriggerElementProps>
> = ({ renderTrigger, showWalletName }) => {
  const isVertical = useIsVerticalLayout();

  const triggerRef = useRef<HTMLElement>(null);
  const { dispatch } = backgroundApiProxy;
  const isDesktopWalletSelectorVisible = useAppSelector(
    (s) => s.accountSelector.isDesktopWalletSelectorVisible,
  );
  const { toggleWalletSelector } = useNavigationActions();
  const { visible } = useWalletSelectorStatus();

  useCloseOnEsc(
    useCallback(() => {
      if (isDesktopWalletSelectorVisible) {
        dispatch(updateDesktopWalletSelectorVisible(false));
      }
    }, [dispatch, isDesktopWalletSelectorVisible]),
  );

  const handleToggleVisible = useCallback(() => {
    toggleWalletSelector();
  }, [toggleWalletSelector]);

  const desktopRef = useRef<DesktopRef | null>(null);
  const setRef = useCallback((ref: DesktopRef | null) => {
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
    if (isVertical) {
      return null;
    }
    return (
      <WalletSelectorDesktop
        ref={setRef}
        visible={visible}
        toggleVisible={handleToggleVisible}
      />
    );
  }, [isVertical, visible, handleToggleVisible, setRef]);

  const handleToggleVisibleDefault = useCallback(() => {
    if (!visible) {
      handleToggleVisible();
    }
  }, [handleToggleVisible, visible]);
  return (
    <Box
      ref={triggerRef}
      position="relative"
      alignItems="flex-start"
      justifyContent="center"
      w="full"
    >
      {renderTrigger?.({ visible, handleToggleVisible }) ?? (
        <WalletSelectorTriggerElement
          visible={visible}
          showWalletName={showWalletName}
          handleToggleVisible={handleToggleVisibleDefault}
        />
      )}
      {child}
    </Box>
  );
};

export default memo(WalletSelectorTrigger);
