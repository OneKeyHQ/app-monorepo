import React, {
  ComponentProps,
  FC,
  ReactElement,
  ReactNode,
  cloneElement,
  useCallback,
  useMemo,
  useState,
} from 'react';

import Box from '../Box';
import Button from '../Button';
import FlatList from '../FlatList';
// import KeyboardAwareScrollView from '../KeyboardAwareScrollView';
import { useUserDevice } from '../Provider/hooks';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';

export type ModalProps = {
  header?: string;
  headerDescription?: string;
  trigger?: ReactElement<any>;
  visible?: boolean;
  closeable?: boolean;
  primaryActionTranslationId?: string;
  secondaryActionTranslationId?: string;
  onPrimaryActionPress?: ({
    onClose,
    close,
  }: {
    onClose?: () => void;
    close: () => void;
  }) => void;
  onSecondaryActionPress?: ({ close }: { close: () => void }) => void;
  hidePrimaryAction?: boolean;
  hideSecondaryAction?: boolean;
  primaryActionProps?: ComponentProps<typeof Button>;
  secondaryActionProps?: ComponentProps<typeof Button>;
  footer?: ReactNode;
  onClose?: () => void | boolean;
  onVisibleChange?: (v: boolean) => void;
  scrollViewProps?: ComponentProps<typeof ScrollView>;
  flatListProps?: ComponentProps<typeof FlatList>;
  sectionListProps?: ComponentProps<typeof SectionList>;
  staticChildrenProps?: ComponentProps<typeof Box>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  height?: number | string;
};

const defaultProps = {
  closeable: true,
  size: 'xs',
  height: 'auto',
} as const;

const Modal: FC<ModalProps> = ({
  trigger,
  visible: outerVisible,
  onClose,
  sectionListProps,
  flatListProps,
  scrollViewProps,
  staticChildrenProps,
  header,
  ...rest
}) => {
  const { size } = useUserDevice();
  const [innerVisible, setInnerVisible] = useState(false);
  const visible = outerVisible ?? innerVisible;

  const handleClose = useCallback(() => {
    if (typeof onClose === 'function') {
      const status = onClose();
      // only onClose return false, will not trigger modal close
      if (status === false) return;
    }
    setInnerVisible((v) => !v);
  }, [onClose]);

  const handleOpen = useCallback(() => {
    setInnerVisible((v) => !v);
  }, []);

  const modalContent = useMemo(() => {
    if (sectionListProps) {
      return (
        <SectionList
          contentContainerStyle={{
            paddingBottom: 24,
            paddingTop: header ? 24 : 0,
          }}
          px={{ base: 4, md: 6 }}
          {...sectionListProps}
        />
      );
    }

    if (flatListProps) {
      return (
        <FlatList
          contentContainerStyle={{
            paddingBottom: 24,
            paddingTop: header ? 24 : 0,
          }}
          px={{ base: 4, md: 6 }}
          {...flatListProps}
        />
      );
    }

    if (scrollViewProps) {
      return (
        <ScrollView
          contentContainerStyle={{
            paddingBottom: 24,
            paddingTop: header ? 24 : 0,
          }}
          px={{ base: 4, md: 6 }}
          {...scrollViewProps}
        />
      );
    }

    if (staticChildrenProps) {
      return <Box {...staticChildrenProps}>{rest.children}</Box>;
    }

    return (
      <Box pt={header ? 6 : 0} pb={6} px={{ base: 4, md: 6 }} flex="1">
        {rest.children}
      </Box>
    );
  }, [
    sectionListProps,
    flatListProps,
    scrollViewProps,
    staticChildrenProps,
    rest.children,
    header,
  ]);

  const modalContainer = useMemo(() => {
    if (['SMALL', 'NORMAL'].includes(size)) {
      return (
        <Mobile
          header={header}
          visible={visible}
          onClose={handleClose}
          {...rest}
        >
          {modalContent}
        </Mobile>
      );
    }

    return (
      <Desktop
        header={header}
        visible={visible}
        onClose={handleClose}
        {...rest}
      >
        {modalContent}
      </Desktop>
    );
  }, [size, visible, handleClose, rest, modalContent, header]);

  const triggerNode = useMemo(() => {
    if (!trigger) return null;
    return cloneElement(trigger, {
      /* eslint @typescript-eslint/no-unsafe-member-access: "off" */
      onPress: trigger.props.onPress ?? handleOpen,
    });
  }, [trigger, handleOpen]);

  return (
    <>
      {triggerNode}
      {modalContainer}
    </>
  );
};

Modal.defaultProps = defaultProps;

export default Modal;
