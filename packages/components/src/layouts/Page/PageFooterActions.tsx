import { getTokenValue } from '../../hooks';
import { Button, Stack, XStack } from '../../primitives';

import type { IButtonProps, IStackProps } from '../../primitives';

type IActionButtonProps = Omit<IButtonProps, 'onPress' | 'children'>;

export type IFooterActionsProps = {
  onConfirm?: () => void | Promise<boolean | void>;
  onCancel?: () => void;
  onConfirmText?: string;
  onCancelText?: string;
  confirmButtonProps?: IActionButtonProps;
  cancelButtonProps?: IActionButtonProps;
} & IStackProps;

export function FooterActions({
  onCancel,
  onCancelText,
  onConfirm,
  onConfirmText,
  confirmButtonProps,
  cancelButtonProps,
}: IFooterActionsProps) {
  return (
    <Stack
      p="$5"
      animation="fast"
      pb={getTokenValue('$size.5') as number}
      bg="$bgApp"
    >
      <XStack justifyContent="flex-end">
        {(!!cancelButtonProps || !!onCancel) && (
          <Button
            $md={
              {
                flex: 1,
                size: 'large',
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
            $md={
              {
                flex: 1,
                size: 'large',
              } as IButtonProps
            }
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
