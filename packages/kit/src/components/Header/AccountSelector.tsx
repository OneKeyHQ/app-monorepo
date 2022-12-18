/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { FC, ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useDrawerStatus } from '@react-navigation/drawer';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import type { DesktopRef } from '@onekeyhq/components/src/Select/Container/Desktop';
import {
  addNewRef,
  removeOldRef,
} from '@onekeyhq/components/src/utils/SelectAutoHide';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useDebounce, useNavigationActions } from '../../hooks';
import { useCloseOnEsc } from '../../hooks/useOnKeydown';
import reducerAccountSelector from '../../store/reducers/reducerAccountSelector';

import {
  ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY,
  ACCOUNT_SELECTOR_PRE_FRESH_BEFORE_OPEN,
} from './AccountSelectorChildren/accountSelectorConsts';
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

const { updateIsOpenDelay, updateDesktopWalletSelectorVisible } =
  reducerAccountSelector.actions;

const AccountSelector: FC<AccountSelectorProps> = ({ renderTrigger }) => {
  const isVertical = useIsVerticalLayout();

  const triggerRef = useRef<HTMLElement>(null);
  const { serviceAccountSelector, dispatch } = backgroundApiProxy;
  const isDesktopWalletSelectorVisible = useAppSelector(
    (s) => s.accountSelector.isDesktopWalletSelectorVisible,
  );
  const { toggleWalletSelector } = useNavigationActions();

  useEffect(() => {
    debugLogger.accountSelector.info('HeaderAccountSelector mount');
    return () => {
      debugLogger.accountSelector.info('HeaderAccountSelector unmounted');
    };
  }, []);

  useCloseOnEsc(
    useCallback(() => {
      if (isDesktopWalletSelectorVisible) {
        dispatch(updateDesktopWalletSelectorVisible(false));
      }
    }, [dispatch, isDesktopWalletSelectorVisible]),
  );

  const isDrawerOpen = useDrawerStatus() === 'open';
  const visible = isVertical ? isDrawerOpen : isDesktopWalletSelectorVisible;

  // delay wait drawer closed animation done
  const isOpenDelay = useDebounce(
    visible,
    isVertical ? ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY : 150,
  );
  useEffect(() => {
    dispatch(updateIsOpenDelay(Boolean(isOpenDelay)));
  }, [dispatch, isOpenDelay]);

  const handleToggleVisible = useCallback(async () => {
    if (ACCOUNT_SELECTOR_PRE_FRESH_BEFORE_OPEN && !visible) {
      await serviceAccountSelector.setSelectedWalletToActive();
      await serviceAccountSelector.refreshAccountsGroup();
    }
    toggleWalletSelector();
  }, [visible, toggleWalletSelector, serviceAccountSelector]);

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
      <AccountSelectorDesktop
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
      h="56px"
      justifyContent="center"
      w="full"
    >
      {renderTrigger?.({ visible, handleToggleVisible }) ?? (
        <AccountSelectorTrigger
          visible={visible}
          handleToggleVisible={handleToggleVisibleDefault}
        />
      )}
      {child}
    </Box>
  );
};

export default memo(AccountSelector);
