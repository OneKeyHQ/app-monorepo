import { useContext } from 'react';

import { Button, type ButtonProps } from '../Button';
import { XStack } from '../Stack';

import { PageContext } from './PageContext';

export interface IPageButtonGroupProps {
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  confirmButtonProps?: ButtonProps;
  cancelButtonProps?: ButtonProps;
}

export function PageButtonGroup() {
  const { options } = useContext(PageContext);
  if (!options?.footerOptions) {
    return null;
  }
  const { onCancel, onConfirm, confirmButtonProps, cancelButtonProps } =
    options.footerOptions;
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
            } as ButtonProps
          }
          $gtSm={
            {
              size: 'medium',
            } as ButtonProps
          }
          onPress={onCancel}
          {...cancelButtonProps}
        >
          Cancel
        </Button>
      )}
      {(!!confirmButtonProps || !!onConfirm) && (
        <Button
          variant="primary"
          $sm={
            {
              flex: 1,
              size: 'large',
            } as ButtonProps
          }
          $gtSm={
            {
              size: 'medium',
            } as ButtonProps
          }
          onPress={onConfirm}
          {...confirmButtonProps}
        >
          Confirm
        </Button>
      )}
    </XStack>
  );
}
