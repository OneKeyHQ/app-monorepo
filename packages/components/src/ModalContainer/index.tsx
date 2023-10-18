import { Checkbox } from '../Checkbox';
import { NewButton } from '../NewButton';
import { Stack, XStack } from '../Stack';

import type { GetProps } from 'tamagui';

type ModalButtonGroupProps = {
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  confirmButtonProps?: GetProps<typeof NewButton>;
  cancelButtonProps?: GetProps<typeof NewButton>;
};

function ModalButtonGroup({
  onCancel,
  onConfirm,
  confirmButtonProps,
  cancelButtonProps,
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
        <NewButton
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
          Cancel
        </NewButton>
      )}
      {(!!confirmButtonProps || !!onConfirm) && (
        <NewButton
          variant="primary"
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
          Confirm
        </NewButton>
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
        />
      </Stack>
    </Stack>
  );
}
