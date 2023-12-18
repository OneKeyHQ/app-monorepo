import { useEffect, useState } from 'react';

import { Button, XStack } from '../../primitives';

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

export function Footer({
  showFooter,
  showCancelButton,
  showConfirmButton,
  cancelButtonProps,
  onConfirm,
  onCancel,
  onConfirmText,
  confirmButtonProps = {},
  onCancelText,
  tone,
}: IDialogFooterProps) {
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
          ml="$2.5"
          disabled={confirmButtonDisabled}
          $md={
            {
              size: 'large',
            } as IButtonProps
          }
          {...restConfirmButtonProps}
          onPress={onConfirm}
        >
          {onConfirmText}
        </Button>
      ) : null}
    </XStack>
  );
}
