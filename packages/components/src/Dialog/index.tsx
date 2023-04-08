import type { ComponentProps, FC, ReactElement, ReactNode } from 'react';
import { cloneElement, useCallback, useMemo, useState } from 'react';

import { MotiView } from 'moti';
import { KeyboardAvoidingView } from 'react-native';

import Box from '../Box';
import KeyboardDismissView from '../KeyboardDismissView';
import OverlayContainer from '../OverlayContainer';
import { CloseBackDrop } from '../Select';

import DialogCommon from './components';

type OuterContainerProps = {
  isVisible?: boolean;
  onClose?: () => void;
};

const Outer: FC<OuterContainerProps> = ({
  isVisible,
  onClose = () => {},
  children,
}) =>
  isVisible ? (
    <OverlayContainer>
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CloseBackDrop onClose={onClose} backgroundColor="#00000066" />
        {children}
      </MotiView>
    </OverlayContainer>
  ) : null;

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
  footerMoreView?: ReactNode;
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
        isVisible={!!visible}
        onClose={() => {
          if (canceledOnTouchOutside) handleClose();
        }}
        {...props}
      >
        <KeyboardDismissView p={6} maxW="432px" justifyContent="center">
          <KeyboardAvoidingView behavior="position">
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
          </KeyboardAvoidingView>
        </KeyboardDismissView>
      </Outer>
    ),
    [
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

export default Dialog;
