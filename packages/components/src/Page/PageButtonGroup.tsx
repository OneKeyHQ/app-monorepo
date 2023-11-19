import type { PropsWithChildren } from 'react';
import { useContext } from 'react';

import { Button, type IButtonProps } from '../Button';
import { XStack } from '../Stack';

import { PageContext } from './PageContext';

export interface IPageButtonGroupProps extends PropsWithChildren<unknown> {
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  onConfirmText?: string;
  onCancelText?: string;
  confirmButtonProps?: IButtonProps;
  cancelButtonProps?: IButtonProps;
}

export function PageButtonGroup() {
  const { options } = useContext(PageContext);
  if (!options?.footerOptions) {
    return null;
  }
  const {
    onCancel,
    onCancelText,
    onConfirm,
    onConfirmText,
    confirmButtonProps,
    cancelButtonProps,
    children,
  } = options.footerOptions;

  if (children) {
    return children;
  }
  return (
    <XStack
      $sm={{
        width: '100%',
        justifyContent: 'center',
        gap: '$5',
      }}
      $gtSm={{
        justifyContent: 'flex-end',
        gap: '$2',
      }}
    >
      {(!!cancelButtonProps || !!onCancel) && (
        <Button
          $sm={
            {
              flex: 1,
              size: 'large',
            } as IButtonProps
          }
          $gtSm={
            {
              size: 'medium',
            } as IButtonProps
          }
          onPress={onCancel}
          {...cancelButtonProps}
        >
          {onCancelText || 'Cancel'}
        </Button>
      )}
      {(!!confirmButtonProps || !!onConfirm) && (
        <Button
          variant="primary"
          $sm={
            {
              flex: 1,
              size: 'large',
            } as IButtonProps
          }
          $gtSm={
            {
              size: 'medium',
            } as IButtonProps
          }
          onPress={onConfirm}
          {...confirmButtonProps}
        >
          {onConfirmText || 'Confirm'}
        </Button>
      )}
    </XStack>
  );
}
