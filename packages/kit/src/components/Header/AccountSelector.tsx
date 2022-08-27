/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, {
  FC,
  ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useDrawerStatus } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { InteractionManager } from 'react-native';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import type { DesktopRef } from '@onekeyhq/components/src/Select/Container/Desktop';
import {
  addNewRef,
  removeOldRef,
} from '@onekeyhq/components/src/utils/SelectAutoHide';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useDebounce } from '../../hooks';
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

const { updateIsOpenDelay } = reducerAccountSelector.actions;

const AccountSelector: FC<AccountSelectorProps> = ({ renderTrigger }) => {
  const isSmallLayout = useIsVerticalLayout();
  const navigation = useNavigation();

  const triggerRef = useRef<HTMLElement>(null);
  const { serviceAccountSelector, dispatch } = backgroundApiProxy;

  useEffect(() => {
    debugLogger.accountSelector.info('HeaderAccountSelector mount');
    return () => {
      debugLogger.accountSelector.info('HeaderAccountSelector unmounted');
    };
  }, []);

  const [innerVisible, setVisible] = useState(false);
  const isDrawerOpen = useDrawerStatus() === 'open';
  const visible = isSmallLayout ? isDrawerOpen : innerVisible;

  // delay wait drawer closed animation done
  const isOpenDelay = useDebounce(
    visible,
    isSmallLayout ? ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY : 150,
  );
  useEffect(() => {
    dispatch(updateIsOpenDelay(Boolean(isOpenDelay)));
  }, [dispatch, isOpenDelay]);

  const handleToggleVisible = useCallback(async () => {
    if (ACCOUNT_SELECTOR_PRE_FRESH_BEFORE_OPEN && !visible) {
      await serviceAccountSelector.setSelectedWalletToActive();
      await serviceAccountSelector.refreshAccountsGroup();
    }
    InteractionManager.runAfterInteractions(() => {
      if (isSmallLayout) {
        // @ts-expect-error
        navigation?.toggleDrawer?.();
      } else {
        setVisible((v) => !v);
      }
    });
  }, [visible, serviceAccountSelector, isSmallLayout, navigation]);

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
    if (isSmallLayout) {
      return null;
    }
    return (
      <AccountSelectorDesktop
        ref={setRef}
        visible={visible}
        toggleVisible={handleToggleVisible}
      />
    );
  }, [isSmallLayout, visible, handleToggleVisible, setRef]);

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
