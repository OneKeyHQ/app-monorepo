import React, {
  ComponentProps,
  FC,
  ReactElement,
  cloneElement,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { Modal as NBModal } from 'native-base';
import { Platform } from 'react-native';
import Modal from 'react-native-modal';
import { RootSiblingParent } from 'react-native-root-siblings';

import Box from '../Box';
import KeyboardDismissView from '../KeyboardDismissView';

import DialogCommon from './components';

const defaultProps = {
  canceledOnTouchOutside: false,
} as const;

type OuterContainerProps = {
  isVisible?: boolean;
  onClose?: () => void;
  hasFormInsideDialog?: boolean;
};

const Outer: FC<OuterContainerProps> = ({
  isVisible,
  onClose,
  children,
  hasFormInsideDialog,
  ...rest
}) => {
  if (Platform.OS !== 'ios') {
    // TODO use animated to do keyboard avoiding
    return (
      <NBModal
        avoidKeyboard
        isOpen={isVisible}
        onClose={onClose}
        bg="#00000066"
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
      backdropColor="rgba(0, 0, 0, 0.6)"
      animationOut="fadeOut"
      animationIn="fadeIn"
      isVisible={isVisible}
      onModalHide={onClose}
      style={{ marginHorizontal: 0 }}
      {...rest}
    >
      <RootSiblingParent>{children}</RootSiblingParent>
    </Modal>
  );
};

export type DialogProps = {
  trigger?: ReactElement<any>;
  /**
   * 手动控制显示隐藏
   */
  visible?: boolean;
  /**
   * 点击 dialog 外面是否可以关闭 dialog，默认：false
   */
  canceledOnTouchOutside?: boolean;
  contentProps?: ComponentProps<typeof DialogCommon.Content>;
  footerButtonProps?: ComponentProps<typeof DialogCommon.FooterButton>;
  footerMoreView?: React.ReactNode;
  onClose?: () => void | boolean;
  onVisibleChange?: (v: boolean) => void;
  hasFormInsideDialog?: boolean;
};

const Dialog: FC<DialogProps> = ({
  trigger,
  visible: outerVisible,
  contentProps,
  footerButtonProps,
  canceledOnTouchOutside,
  footerMoreView,
  onClose,
  hasFormInsideDialog,
  ...props
}) => {
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

  const container = useMemo(
    () => (
      <Outer
        hasFormInsideDialog={hasFormInsideDialog}
        isVisible={!!visible}
        onClose={() => {
          if (canceledOnTouchOutside) handleClose();
        }}
        {...props}
      >
        <KeyboardDismissView
          p={6}
          w="100%"
          h="auto"
          maxW="432px"
          alignSelf="center"
        >
          <Box
            w="100%"
            p={{ base: '4', lg: '6' }}
            shadow="depth.5"
            borderRadius="24px"
            bg="background-default"
          >
            {props.children ? (
              props.children
            ) : (
              <Box minW={{ md: '80', sm: '4/5' }}>
                {!!contentProps && <DialogCommon.Content {...contentProps} />}
                {footerMoreView ?? footerMoreView}
                {(!footerButtonProps?.hidePrimaryAction ||
                  !footerButtonProps?.hideSecondaryAction) && (
                  <DialogCommon.FooterButton
                    {...footerButtonProps}
                    onSecondaryActionPress={() => {
                      handleClose();
                      setTimeout(() => {
                        footerButtonProps?.onSecondaryActionPress?.();
                      }, 50);
                    }}
                    onPrimaryActionPress={() => {
                      footerButtonProps?.onPrimaryActionPress?.({ onClose });
                    }}
                  />
                )}
              </Box>
            )}
          </Box>
        </KeyboardDismissView>
      </Outer>
    ),
    [
      hasFormInsideDialog,
      visible,
      props,
      contentProps,
      footerButtonProps,
      canceledOnTouchOutside,
      footerMoreView,
      handleClose,
      onClose,
    ],
  );

  const triggerNode = useMemo(() => {
    if (!trigger) return null;
    return cloneElement(trigger, { onPress: handleOpen });
  }, [trigger, handleOpen]);

  return (
    <>
      {triggerNode}
      {container}
    </>
  );
};

Dialog.defaultProps = defaultProps;
export default Dialog;
