import React, {
  ComponentProps,
  FC,
  ReactElement,
  cloneElement,
  useCallback,
  useMemo,
  useState,
} from 'react';

import Modal from 'react-native-modal';

import Box from '../Box';

import DialogCommon from './components';

const defaultProps = {
  canceledOnTouchOutside: true,
} as const;

export type DialogProps = {
  trigger?: ReactElement<any>;
  /**
   * 手动控制显示隐藏
   */
  visible?: boolean;
  /**
   * 点击 dialog 外面是否可以关闭 dialog，默认：true
   */
  canceledOnTouchOutside?: boolean;
  contentProps?: ComponentProps<typeof DialogCommon.Content>;
  footerButtonProps?: ComponentProps<typeof DialogCommon.FooterButton>;
  onClose?: () => void | boolean;
  onVisibleChange?: (v: boolean) => void;
};

const Dialog: FC<DialogProps> = ({
  trigger,
  visible: outerVisible,
  contentProps,
  footerButtonProps,
  canceledOnTouchOutside,
  onClose,
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
      <Modal
        useNativeDriver
        propagateSwipe
        hideModalContentWhileAnimating
        isVisible={!!visible}
        swipeDirection={['down']}
        onBackdropPress={() => {
          if (canceledOnTouchOutside) handleClose();
        }}
        animationIn="zoomIn"
        animationOut="zoomOut"
        {...props}
      >
        <Box
          p="16px"
          w="100%"
          maxW="560px"
          alignSelf="center"
          borderRadius="24px"
          bg="surface-subdued"
        >
          {props.children ? (
            props.children
          ) : (
            <Box>
              {!!contentProps && <DialogCommon.Content {...contentProps} />}
              {(!footerButtonProps?.hidePrimaryAction ||
                !footerButtonProps?.hideSecondaryAction) && (
                <DialogCommon.FooterButton
                  {...footerButtonProps}
                  onSecondaryActionPress={() => {
                    handleClose();
                    footerButtonProps?.onSecondaryActionPress?.();
                  }}
                  onPrimaryActionPress={() => {
                    footerButtonProps?.onPrimaryActionPress?.({ onClose });
                  }}
                />
              )}
            </Box>
          )}
        </Box>
      </Modal>
    ),
    [
      visible,
      props,
      contentProps,
      footerButtonProps,
      canceledOnTouchOutside,
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
