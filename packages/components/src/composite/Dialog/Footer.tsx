import type { PropsWithChildren } from 'react';
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useKeyboardEvent, useSafeAreaInsets } from '../../hooks';
import { Button, XStack } from '../../primitives';

import { DialogContext } from './context';
import { useDialogInstance } from './hooks';

import type { IDialogFooterProps } from './type';
import type { IButtonProps } from '../../primitives';

const useConfirmButtonDisabled = (
  props: IDialogFooterProps['confirmButtonProps'],
) => {
  const { disabledOn, disabled } = props || {};
  const { getForm } = useDialogInstance();
  const [, updateStatus] = useState(0);
  useEffect(() => {
    const form = getForm();
    if (form && disabledOn) {
      const subscription = form.watch(() => {
        updateStatus((i) => i + 1);
      });
      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }
  }, [disabledOn, getForm]);
  return typeof disabled !== 'undefined' ? disabled : disabledOn?.({ getForm });
};

const useDialogFooterProps = (props: IDialogFooterProps) => {
  const { footerRef, dialogInstance } = useContext(DialogContext);
  const [, setCount] = useState(0);
  // assign notifyUpdate before component mounted
  useMemo(() => {
    footerRef.notifyUpdate = () => setCount((i) => i + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { onConfirm, ...restProps } = footerRef.props || props || {};

  const handleConfirm = useCallback(async () => {
    const { close, ref } = dialogInstance;
    const form = ref.current;
    if (form) {
      const isValidated = await form.trigger();
      if (!isValidated) {
        return;
      }
    }

    const result = onConfirm
      ? await new Promise<boolean>((resolve) => {
          void Promise.resolve(
            onConfirm?.({
              close: (extra) => {
                resolve(false);
                void close(extra);
              },
              preventClose: () => {
                resolve(false);
              },
              getForm: () => dialogInstance.ref.current,
            }),
          ).then(() => {
            resolve(true);
          });
        })
      : true;
    if (result) {
      void close();
    }
  }, [onConfirm, dialogInstance]);

  return {
    props: restProps,
    onConfirm: handleConfirm,
  };
};

const useSafeKeyboardAnimationStyle = () => {
  const { bottom } = useSafeAreaInsets();
  const keyboardHeightValue = useSharedValue(0);
  const animatedStyles = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeightValue.value + bottom,
  }));

  useKeyboardEvent({
    keyboardWillShow: (e) => {
      const keyboardHeight = e.endCoordinates.height;
      keyboardHeightValue.value = keyboardHeight - bottom;
    },
    keyboardWillHide: () => {
      keyboardHeightValue.value = 0;
    },
  });
  return platformEnv.isNative ? animatedStyles : undefined;
};

const DialogFooterContainer = ({ children }: PropsWithChildren) => {
  const safeKeyboardAnimationStyle = useSafeKeyboardAnimationStyle();
  return (
    <Animated.View style={safeKeyboardAnimationStyle}>{children}</Animated.View>
  );
};

export function Footer(props: IDialogFooterProps) {
  const intl = useIntl();
  const { props: restProps, onConfirm } = useDialogFooterProps(props);
  const {
    showFooter,
    showCancelButton,
    showConfirmButton,
    cancelButtonProps,
    onConfirmText,
    footerProps,
    confirmButtonProps = {},
    onCancelText,
    tone,
  } = restProps;
  const { onCancel } = props;
  const { disabled, disabledOn, ...restConfirmButtonProps } =
    confirmButtonProps;
  const confirmButtonDisabled = useConfirmButtonDisabled({
    disabled,
    disabledOn,
  });
  return (
    <DialogFooterContainer>
      {showFooter ? (
        <XStack p="$5" pt="$0" space="$2.5" {...footerProps}>
          {showCancelButton ? (
            <Button
              flexGrow={1}
              flexBasis={0}
              $md={
                {
                  size: 'large',
                } as IButtonProps
              }
              {...cancelButtonProps}
              onPress={onCancel}
            >
              {onCancelText ||
                intl.formatMessage({ id: ETranslations.global_cancel })}
            </Button>
          ) : null}
          {showConfirmButton ? (
            <Button
              variant={tone === 'destructive' ? 'destructive' : 'primary'}
              flexGrow={1}
              flexBasis={0}
              disabled={confirmButtonDisabled}
              $md={
                {
                  size: 'large',
                } as IButtonProps
              }
              {...restConfirmButtonProps}
              onPress={onConfirm}
            >
              {onConfirmText ||
                intl.formatMessage({ id: ETranslations.global_confirm })}
            </Button>
          ) : null}
        </XStack>
      ) : null}
    </DialogFooterContainer>
  );
}

function BasicFooterAction({
  showFooter = true,
  footerProps,
  showCancelButton = true,
  showConfirmButton = true,
  cancelButtonProps,
  onConfirm,
  onConfirmText,
  onCancel,
  onCancelText,
  confirmButtonProps = {},
  tone,
}: IDialogFooterProps) {
  const intl = useIntl();
  const { footerRef } = useContext(DialogContext);
  // assign props before component mounted
  useMemo(() => {
    footerRef.props = {
      showFooter,
      footerProps,
      showCancelButton,
      showConfirmButton,
      cancelButtonProps,
      onConfirm,
      onCancel,
      onConfirmText,
      confirmButtonProps,
      onCancelText,
      tone,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    footerRef.props = {
      showFooter,
      footerProps,
      showCancelButton,
      showConfirmButton,
      cancelButtonProps,
      onConfirm,
      onCancel,
      onConfirmText:
        onConfirmText ||
        intl.formatMessage({ id: ETranslations.global_confirm }),
      confirmButtonProps,
      onCancelText:
        onCancelText || intl.formatMessage({ id: ETranslations.global_cancel }),
      tone,
    };
    footerRef.notifyUpdate?.();
  }, [
    showFooter,
    footerProps,
    showCancelButton,
    showConfirmButton,
    cancelButtonProps,
    onConfirm,
    onCancel,
    onConfirmText,
    confirmButtonProps,
    onCancelText,
    tone,
    footerRef,
    intl,
  ]);
  return null;
}

export const FooterAction = memo(BasicFooterAction);
