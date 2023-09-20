import type { FC } from 'react';
import { useEffect, useRef } from 'react';

import { Modalize } from 'react-native-modalize';

import {
  Box,
  Modal,
  PresenceTransition,
  useIsVerticalLayout,
  useSafeAreaInsets,
  useThemeValue,
} from '@onekeyhq/components';
import type { UseDropdownProps } from '@onekeyhq/components/src/hooks/useDropdownPosition';
import { useDropdownPosition } from '@onekeyhq/components/src/hooks/useDropdownPosition';
import type { ModalProps } from '@onekeyhq/components/src/Modal';
import type { SelectProps } from '@onekeyhq/components/src/Select';
import { CloseBackDrop } from '@onekeyhq/components/src/Select';

import type { IBoxProps } from 'native-base';
import type { ModalizeProps } from 'react-native-modalize';

const ModalizedPanel: FC<{
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

const DesktopDropdown: FC<{
  closeOverlay: () => void;
  triggerEle?: SelectProps['triggerEle'];
  dropdownStyle?: IBoxProps;
  useDropdownProps?: UseDropdownProps;
}> = ({
  closeOverlay,
  children,
  triggerEle,
  dropdownStyle,
  useDropdownProps,
}) => {
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
      ...useDropdownProps,
    });
  return (
    <Box position="absolute" w="full" h="full">
      <CloseBackDrop onClose={closeOverlay} />
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
          {...dropdownStyle}
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
  modalLizeProps?: ModalizeProps;
  useDropdownProps?: UseDropdownProps;
  dropdownStyle?: IBoxProps;
}> = (props) => {
  const isVerticalLayout = useIsVerticalLayout();

  return isVerticalLayout ? (
    <ModalizedPanel {...props} />
  ) : (
    <DesktopDropdown {...props} />
  );
};
