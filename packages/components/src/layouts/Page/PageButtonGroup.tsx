import type { PropsWithChildren } from 'react';
import { useContext } from 'react';

import { Button, type IButtonProps, Stack, XStack } from '../../primitives';

import { PageContext } from './PageContext';
import { useKeyboardHeight } from '../../hooks';

type IActionButtonProps = Omit<IButtonProps, 'onPress' | 'children'>;

export interface IPageButtonGroupProps extends PropsWithChildren<unknown> {
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  onConfirmText?: string;
  onCancelText?: string;
  confirmButtonProps?: IActionButtonProps;
  cancelButtonProps?: IActionButtonProps;
}

export function PageButtonGroup() {
  const { options } = useContext(PageContext);
  const height = useKeyboardHeight();
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
    <Stack p="$5" marginBottom={height}>
      <XStack justifyContent="flex-end">
        {(!!cancelButtonProps || !!onCancel) && (
          <Button
            $md={
              {
                flex: 1,
                size: 'large',
              } as IButtonProps
            }
            $platform-native={{}}
            onPress={onCancel}
            {...cancelButtonProps}
          >
            {onCancelText || 'Cancel'}
          </Button>
        )}
        {(!!confirmButtonProps || !!onConfirm) && (
          <Button
            $md={
              {
                flex: 1,
                size: 'large',
              } as IButtonProps
            }
            $platform-native={{}}
            variant="primary"
            onPress={onConfirm}
            {...confirmButtonProps}
          >
            {onConfirmText || 'Confirm'}
          </Button>
        )}
      </XStack>
    </Stack>
  );
}
