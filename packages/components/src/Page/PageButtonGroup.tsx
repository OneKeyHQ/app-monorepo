import { useContext } from 'react';

import { Button, type IButtonProps } from '../Button';
import { XStack } from '../Stack';

import { PageContext } from './PageContext';

export interface IPageButtonGroupProps {
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  confirmButtonProps?: IButtonProps;
  cancelButtonProps?: IButtonProps;
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
          Confirm
        </Button>
      )}
    </XStack>
  );
}
