import React, {
  ComponentProps,
  FC,
  ReactElement,
  cloneElement,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { Modal, Pressable } from 'native-base';
import { Keyboard } from 'react-native';

import Box from '../Box';
import { ButtonSize } from '../Button';
import { useUserDevice } from '../Provider/hooks';

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
  footerMoreView?: React.ReactNode;
  onClose?: () => void | boolean;
  onVisibleChange?: (v: boolean) => void;
};

const Dialog: FC<DialogProps> = ({
  trigger,
  visible: outerVisible,
  contentProps,
  footerButtonProps,
  canceledOnTouchOutside,
  footerMoreView,
  onClose,
  ...props
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

  const buttonSize = useCallback((): ButtonSize => {
    if (['SMALL', 'NORMAL'].includes(size)) {
      return 'lg';
    }
    return 'base';
  }, [size]);

  const container = useMemo(
    () => (
      <Modal
        bg="#00000066"
        animationPreset="fade"
        isOpen={!!visible}
        avoidKeyboard
        onClose={() => {
          if (canceledOnTouchOutside) handleClose();
        }}
        {...props}
      >
        <Pressable
          p={6}
          w="100%"
          maxW="432px"
          onPress={() => Keyboard.dismiss()}
        >
          <Box
            w="100%"
            p={{ base: '4', lg: '6' }}
            shadow="depth.5"
            alignSelf="center"
            borderRadius="24px"
            bg="surface-subdued"
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
                    buttonSize={buttonSize()}
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
        </Pressable>
      </Modal>
    ),
    [
      visible,
      props,
      contentProps,
      footerButtonProps,
      buttonSize,
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
