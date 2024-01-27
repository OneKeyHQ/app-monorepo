import type { PropsWithChildren } from 'react';
import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { getTokenValue } from '../../hooks';
import { Button, Stack, XStack } from '../../primitives';

import type { IButtonProps, IStackProps } from '../../primitives';

type IActionButtonProps = Omit<IButtonProps, 'children'>;

export type IFooterActionsProps = {
  onConfirm?: (params: { close: () => void }) => void;
  onCancel?: () => void | Promise<void>;
  onConfirmText?: string;
  onCancelText?: string;
  confirmButtonProps?: IActionButtonProps;
  cancelButtonProps?: IActionButtonProps;
  buttonContainerProps?: IStackProps;
} & IStackProps;

export function FooterActions({
  onCancel,
  onCancelText,
  onConfirm,
  onConfirmText,
  confirmButtonProps,
  cancelButtonProps,
  buttonContainerProps,
  children,
  ...restProps
}: PropsWithChildren<IFooterActionsProps>) {
  const { pop } = useAppNavigation();
  const handleCancel = useCallback(async () => {
    await onCancel?.();
    pop();
  }, [onCancel, pop]);

  const handleConfirm = useCallback(() => {
    onConfirm?.({ close: pop });
  }, [onConfirm, pop]);
  return (
    <Stack
      p="$5"
      animation="fast"
      pb={getTokenValue('$size.5') as number}
      bg="$bgApp"
      {...restProps}
    >
      {children}
      <XStack justifyContent="flex-end" space="$2.5" {...buttonContainerProps}>
        {(!!cancelButtonProps || !!onCancel) && (
          <Button
            $md={
              {
                flex: 1,
                size: 'large',
              } as IButtonProps
            }
            onPress={handleCancel}
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
            variant="primary"
            onPress={handleConfirm}
            {...confirmButtonProps}
          >
            {onConfirmText || 'Confirm'}
          </Button>
        )}
      </XStack>
    </Stack>
  );
}
