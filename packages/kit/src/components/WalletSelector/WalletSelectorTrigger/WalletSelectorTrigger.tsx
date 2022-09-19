/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, {
  FC,
  ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import type { DesktopRef } from '@onekeyhq/components/src/Select/Container/Desktop';
import {
  addNewRef,
  removeOldRef,
} from '@onekeyhq/components/src/utils/SelectAutoHide';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';
import { useWalletSelectorStatus } from '../useWalletSelectorStatus';
import WalletSelectorDesktop from '../WalletSelectorDesktop';

import { WalletSelectorTriggerElement } from './WalletSelectorTriggerElement';

type AccountSelectorProps = {
  renderTrigger?: ({
    visible,
    handleToggleVisible,
  }: {
    visible: boolean;
    handleToggleVisible: () => void;
  }) => ReactNode;
};

const { updateDesktopSelectorVisible } = reducerAccountSelector.actions;

const WalletSelectorTrigger: FC<AccountSelectorProps> = ({ renderTrigger }) => {
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation();

  const triggerRef = useRef<HTMLElement>(null);
  const { dispatch } = backgroundApiProxy;
  const { isDesktopSelectorVisible } = useAppSelector((s) => s.accountSelector);
  const { visible } = useWalletSelectorStatus();

  useEffect(() => {
    debugLogger.accountSelector.info('HeaderAccountSelector mount');
    return () => {
      debugLogger.accountSelector.info('HeaderAccountSelector unmounted');
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (platformEnv.isRuntimeBrowser) {
        const closeOnEsc = (e: KeyboardEvent) => {
          if (e.code === 'Escape' && isDesktopSelectorVisible) {
            dispatch(updateDesktopSelectorVisible(false));
          }
        };
        document.addEventListener('keydown', closeOnEsc);
        return () => {
          document.removeEventListener('keydown', closeOnEsc);
        };
      }
    }, [dispatch, isDesktopSelectorVisible]),
  );

  const handleToggleVisible = useCallback(() => {
    setTimeout(() => {
      // TODO move to useNavigationActions
      if (isVertical) {
        // @ts-expect-error
        navigation?.toggleDrawer?.();
      } else {
        const nextVisible = !isDesktopSelectorVisible;
        dispatch(updateDesktopSelectorVisible(nextVisible));
      }
    });
  }, [isVertical, navigation, isDesktopSelectorVisible, dispatch]);

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
      h="56px"
      justifyContent="center"
      w="full"
    >
      {renderTrigger?.({ visible, handleToggleVisible }) ?? (
        <WalletSelectorTriggerElement
          visible={visible}
          handleToggleVisible={handleToggleVisibleDefault}
        />
      )}
      {child}
    </Box>
  );
};

export default memo(WalletSelectorTrigger);
