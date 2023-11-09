import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { Stack, XStack } from '../Stack';

import type { IButtonProps } from '../Button';
import type { GetProps } from 'tamagui';

type IModalButtonGroupProps = {
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  confirmButtonProps?: GetProps<typeof Button>;
  cancelButtonProps?: GetProps<typeof Button>;
};

function ModalButtonGroup({
  onCancel,
  onConfirm,
  confirmButtonProps,
  cancelButtonProps,
}: IModalButtonGroupProps) {
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

type IModalContainerProps = {
  children: React.ReactNode;
  checkboxProps?: GetProps<typeof Checkbox>;
} & IModalButtonGroupProps;

export function ModalContainer({
  children,
  checkboxProps,
  onCancel,
  onConfirm,
  confirmButtonProps,
  cancelButtonProps,
}: IModalContainerProps) {
  return (
    <Stack flex={1}>
      <Stack flex={1}>{children}</Stack>

      <Stack
        bg="$bg"
        padding="$5"
        $sm={{
          flexDirection: 'column',
          alignItems: 'center',
        }}
        $gtSm={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {!!checkboxProps && (
          <Stack
            $sm={{
              width: '100%',
              alignItems: 'flex-start',
              mb: '$2.5',
            }}
            $gtSm={{
              justifyContent: 'center',
            }}
          >
            <Checkbox {...checkboxProps} />
          </Stack>
        )}
        <ModalButtonGroup
          onCancel={onCancel}
          onConfirm={onConfirm}
          confirmButtonProps={confirmButtonProps}
          cancelButtonProps={cancelButtonProps}
        />
      </Stack>
    </Stack>
  );
}
