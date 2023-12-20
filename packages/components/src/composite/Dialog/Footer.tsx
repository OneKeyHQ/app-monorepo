import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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
              close,
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

export function Footer(props: IDialogFooterProps) {
  const { props: restProps, onConfirm } = useDialogFooterProps(props);
  const {
    showFooter,
    showCancelButton,
    showConfirmButton,
    cancelButtonProps,
    onConfirmText,
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
  if (!showFooter) {
    return null;
  }
  return (
    <XStack p="$5" pt="$0">
      {showCancelButton ? (
        <Button
          flex={1}
          $md={
            {
              size: 'large',
            } as IButtonProps
          }
          {...cancelButtonProps}
          onPress={onCancel}
        >
          {onCancelText}
        </Button>
      ) : null}
      {showConfirmButton ? (
        <Button
          variant={tone === 'destructive' ? 'destructive' : 'primary'}
          flex={1}
          disabled={confirmButtonDisabled}
          $md={
            {
              size: 'large',
            } as IButtonProps
          }
          {...restConfirmButtonProps}
          {...(showCancelButton && {
            ml: '$2.5',
          })}
          onPress={onConfirm}
        >
          {onConfirmText}
        </Button>
      ) : null}
    </XStack>
  );
}

function BasicFooterAction({
  showFooter = true,
  showCancelButton = true,
  showConfirmButton = true,
  cancelButtonProps,
  onConfirm,
  onCancel,
  onConfirmText,
  confirmButtonProps = {},
  onCancelText,
  tone,
}: IDialogFooterProps) {
  const { footerRef } = useContext(DialogContext);
  // assign props before component mounted
  useMemo(() => {
    footerRef.props = {
      showFooter,
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
    footerRef.notifyUpdate?.();
  }, [
    showFooter,
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
  ]);
  return null;
}

export const FooterAction = memo(BasicFooterAction);
