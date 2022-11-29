import { FC, useEffect, useRef } from 'react';

import { IBoxProps } from 'native-base';
import { Modalize, ModalizeProps } from 'react-native-modalize';

import {
  Box,
  Modal,
  PresenceTransition,
  useIsVerticalLayout,
  useSafeAreaInsets,
  useThemeValue,
} from '@onekeyhq/components';
import { ModalProps } from '@onekeyhq/components/src/Modal';

const BottomSheetModal: FC<{
  closeOverlay: () => void;
  modalProps?: ModalProps;
  modalLizeProps?: ModalizeProps;
}> = ({ closeOverlay, modalProps, children, modalLizeProps }) => {
  const modalizeRef = useRef<Modalize>(null);

  const bg = useThemeValue('surface-subdued');

  const { bottom } = useSafeAreaInsets();
  useEffect(() => {
    setTimeout(() => modalizeRef.current?.open(), 10);
  }, []);
  return (
    <Modalize
      ref={modalizeRef}
      onClosed={closeOverlay}
      closeOnOverlayTap
      adjustToContentHeight
      withHandle={false}
      modalStyle={{
        backgroundColor: bg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
      }}
      {...modalLizeProps}
    >
      <Modal
        visible
        footer={null}
        closeAction={closeOverlay}
        staticChildrenProps={{
          padding: '8px',
          paddingBottom: `${bottom + 8}px`,
        }}
        {...modalProps}
      >
        {children}
      </Modal>
    </Modalize>
  );
};
export default BottomSheetModal;
