import type { PropsWithChildren } from 'react';
import { useContext } from 'react';

import { Button, type IButtonProps, Stack, XStack } from '../../primitives';

import { PageContext } from './PageContext';

type IActionButtonProps = Omit<IButtonProps, 'onPress' | 'children'>;

export interface IPageButtonGroupProps extends PropsWithChildren<unknown> {
  onConfirm?: () => void | Promise<boolean> | Promise<void>;
  onCancel?: () => void;
  onConfirmText?: string;
  onCancelText?: string;
  confirmButtonProps?: IActionButtonProps;
  cancelButtonProps?: IActionButtonProps;
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
    <Stack
      bg="$bgApp"
      pt="$4"
      $sm={{
        flexDirection: 'column',
        alignItems: 'center',
      }}
      $gtSm={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: '$4',
      }}
    >
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
          <Button onPress={onCancel} {...cancelButtonProps}>
            {onCancelText || 'Cancel'}
          </Button>
        )}
        {(!!confirmButtonProps || !!onConfirm) && (
          <Button variant="primary" onPress={onConfirm} {...confirmButtonProps}>
            {onConfirmText || 'Confirm'}
          </Button>
        )}
      </XStack>
    </Stack>
  );
}
