import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { Stack, XStack } from '../Stack';

import type { GetProps } from 'tamagui';

type ModalButtonGroupProps = {
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  confirmButtonProps?: GetProps<typeof Button>;
  cancelButtonProps?: GetProps<typeof Button>;
  confirmButtonTextProps?: GetProps<typeof Button.Text>;
  cancelButtonTextProps?: GetProps<typeof Button.Text>;
};

function ModalButtonGroup({
  onCancel,
  onConfirm,
  confirmButtonProps,
  cancelButtonProps,
  confirmButtonTextProps,
  cancelButtonTextProps,
}: ModalButtonGroupProps) {
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
          buttonVariant="secondary"
          $sm={{
            flex: 1,
            size: 'large',
          }}
          $gtSm={{
            size: 'medium',
          }}
          onPress={onCancel}
          {...cancelButtonProps}
        >
          <Button.Text paddingHorizontal="$3" {...cancelButtonTextProps}>
            Cancel
          </Button.Text>
        </Button>
      )}
      {(!!confirmButtonProps || !!onConfirm) && (
        <Button
          buttonVariant="primary"
          $sm={{
            flex: 1,
            size: 'large',
          }}
          $gtSm={{
            size: 'medium',
          }}
          onPress={onConfirm}
          {...confirmButtonProps}
        >
          <Button.Text paddingHorizontal="$3" {...confirmButtonTextProps}>
            Confirm
          </Button.Text>
        </Button>
      )}
    </XStack>
  );
}

type ModalContainerProps = {
  children: React.ReactNode;
  checkboxProps?: GetProps<typeof Checkbox>;
} & ModalButtonGroupProps;

export function ModalContainer({
  children,
  checkboxProps,
  onCancel,
  onConfirm,
  confirmButtonProps,
  cancelButtonProps,
  confirmButtonTextProps,
  cancelButtonTextProps,
}: ModalContainerProps) {
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
          confirmButtonTextProps={confirmButtonTextProps}
          cancelButtonTextProps={cancelButtonTextProps}
        />
      </Stack>
    </Stack>
  );
}
