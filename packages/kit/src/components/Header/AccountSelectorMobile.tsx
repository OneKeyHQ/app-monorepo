import React, { FC } from 'react';

import Modal from 'react-native-modal';

import { Box, useSafeAreaInsets } from '@onekeyhq/components';

import AccountSelectorChildren from './AccountSelectorChildren';

type ChildDropdownProps = {
  visible: boolean;
  handleToggleVisible: () => void;
};

const AccountSelectorMobile: FC<ChildDropdownProps> = ({
  visible,
  handleToggleVisible,
}) => {
  const { top } = useSafeAreaInsets();
  return (
    <Modal
      useNativeDriver
      propagateSwipe
      hideModalContentWhileAnimating
      swipeDirection={['down']}
      isVisible={!!visible}
      onSwipeComplete={handleToggleVisible}
      onBackdropPress={handleToggleVisible}
      animationIn="slideInLeft"
      animationOut="slideOutLeft"
      animationInTiming={150}
      animationOutTiming={150}
      style={{
        justifyContent: 'flex-end',
        margin: 0,
      }}
    >
      <Box
        width="80%"
        flex="1"
        bg="surface-subdued"
        flexDirection="row"
        pt={`${top}px`}
      >
        <AccountSelectorChildren />
      </Box>
    </Modal>
  );
};

export default AccountSelectorMobile;
