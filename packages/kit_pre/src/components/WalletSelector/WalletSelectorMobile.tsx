import { useEffect } from 'react';

import {
  DrawerContentScrollView,
  useDrawerStatus,
} from '@react-navigation/drawer';
import { StyleSheet } from 'react-native';

import { useIsVerticalLayout } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigationActions } from '../../hooks';
import reducerAccountSelector from '../../store/reducers/reducerAccountSelector';

import WalletSelectorChildren from './WalletSelectorChildren';

import type { DrawerContentComponentProps } from '@react-navigation/drawer';

const { updateMobileWalletSelectorDrawerOpen } = reducerAccountSelector.actions;

const styles = StyleSheet.create({
  contentContainerStyle: {
    flexDirection: 'row',
    flex: 1,
  },
});
export function WalletSelectorMobile(props: DrawerContentComponentProps) {
  const isVerticalLayout = useIsVerticalLayout();

  const { dispatch } = backgroundApiProxy;
  const drawerStatus = useDrawerStatus();
  const { closeDrawer } = useNavigationActions();
  const isDrawerOpen = drawerStatus === 'open';

  useEffect(() => {
    dispatch(updateMobileWalletSelectorDrawerOpen(isDrawerOpen));
  }, [dispatch, isDrawerOpen]);

  useEffect(() => {
    if (!isVerticalLayout && isDrawerOpen) {
      closeDrawer();
    }
  }, [closeDrawer, isDrawerOpen, isVerticalLayout]);

  if (!isVerticalLayout) {
    return null;
  }

  // accountSelectorInfo, isOpen
  return (
    <DrawerContentScrollView
      {...props}
      scrollEnabled={false}
      contentContainerStyle={styles.contentContainerStyle}
    >
      {/* AccountSelectorMobile */}
      <WalletSelectorChildren />
    </DrawerContentScrollView>
  );
}
