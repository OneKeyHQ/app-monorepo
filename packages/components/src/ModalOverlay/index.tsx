import { FC } from 'react';

import { Modal as NBModal } from 'native-base';
import Modal from 'react-native-modal';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

type ModalOverlayProps = {
  onClose?: () => void;
  hasFormInsideDialog?: boolean;
};

const ModalOverlay: FC<ModalOverlayProps> = ({
  onClose,
  children,
  ...rest
}) => {
  if (!platformEnv.isNativeIOS) {
    return (
      <NBModal
        isOpen
        onClose={onClose}
        bg="overlay"
        animationPreset="fade"
        {...rest}
      >
        {children}
      </NBModal>
    );
  }

  return (
    <Modal
      avoidKeyboard
      backdropColor="overlay"
      animationOut="fadeOut"
      animationIn="fadeIn"
      isVisible
      onModalHide={onClose}
      style={{ marginHorizontal: 0 }}
      {...rest}
    >
      {children}
    </Modal>
  );
};

export default ModalOverlay;
