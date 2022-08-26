import { FC, useEffect, useRef } from 'react';

import { Modalize } from 'react-native-modalize';

import {
  Box,
  Modal,
  PresenceTransition,
  useIsVerticalLayout,
  useSafeAreaInsets,
  useThemeValue,
} from '@onekeyhq/components';
import { useDropdownPosition } from '@onekeyhq/components/src/hooks/useDropdownPosition';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import { CloseButton, SelectProps } from '@onekeyhq/components/src/Select';

const ModalizedPanel: FC<{
  closeOverlay: () => void;
  modalProps?: ModalProps;
}> = ({ closeOverlay, modalProps, children }) => {
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

const DesktopDropdown: FC<{
  closeOverlay: () => void;
  triggerEle?: SelectProps['triggerEle'];
}> = ({ closeOverlay, children, triggerEle }) => {
  const translateY = 2;
  const contentRef = useRef();
  const { position, toPxPositionValue, isPositionNotReady } =
    useDropdownPosition({
      contentRef,
      triggerEle,
      visible: true,
      translateY,
      dropdownPosition: 'right',
      autoAdjust: false,
    });
  return (
    <Box position="absolute" w="full" h="full">
      <CloseButton onClose={closeOverlay} />
      <PresenceTransition
        visible={!isPositionNotReady}
        initial={{ opacity: 0, translateY: 0 }}
        animate={{
          opacity: 1,
          translateY,
          transition: {
            duration: 150,
          },
        }}
      >
        <Box
          overflow="hidden"
          bg="surface-subdued"
          position="absolute"
          w="240px"
          p="4px"
          borderRadius="12px"
          borderWidth={1}
          borderColor="border-subdued"
          ref={contentRef}
          left={toPxPositionValue(position.left)}
          right={toPxPositionValue(position.right)}
          top={toPxPositionValue(position.top)}
          bottom={toPxPositionValue(position.bottom)}
        >
          {children}
        </Box>
      </PresenceTransition>
    </Box>
  );
};

export const OverlayPanel: FC<{
  closeOverlay: () => void;
  triggerEle?: SelectProps['triggerEle'];
  modalProps?: ModalProps;
}> = (props) => {
  const isVerticalLayout = useIsVerticalLayout();

  return isVerticalLayout ? (
    <ModalizedPanel {...props} />
  ) : (
    <DesktopDropdown {...props} />
  );
};
