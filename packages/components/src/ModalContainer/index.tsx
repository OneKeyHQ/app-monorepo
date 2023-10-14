import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { Stack, XStack } from '../Stack';

import type { GetProps } from 'tamagui';

type ModalContainerProps = {
  children: React.ReactNode;
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  checkboxProps?: GetProps<typeof Checkbox>;
  confirmButtonProps?: GetProps<typeof Button>;
  cancelButtonProps?: GetProps<typeof Button>;
  confirmButtonTextProps?: GetProps<typeof Button.Text>;
  cancelButtonTextProps?: GetProps<typeof Button.Text>;
};

export function ModalContainer({
  children,
  onCancel,
  onConfirm,
  checkboxProps,
  confirmButtonProps,
  cancelButtonProps,
  confirmButtonTextProps,
  cancelButtonTextProps,
}: ModalContainerProps) {
  return (
    <Stack flex={1}>
      {children}

      <Stack
        bg="$bg"
        padding="$5"
        $sm={{
          flexDirection: 'column',
          alignItems: 'center',
        }}
        $gtSm={{
          flexDirection: 'row',
          alignItems: 'flex-start',
        }}
      >
        {!!checkboxProps && (
          <Stack
            $sm={{
              width: '100%',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              mb: '$2.5',
            }}
            $gtSm={{
              height: '100%',
              justifyContent: 'center',
            }}
          >
            <Checkbox {...checkboxProps} />
          </Stack>
        )}
        <XStack
          flex={1}
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
              {...cancelButtonProps}
              onPress={onCancel}
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
              {...confirmButtonProps}
              onPress={onConfirm}
            >
              <Button.Text paddingHorizontal="$3" {...confirmButtonTextProps}>
                Confirm
              </Button.Text>
            </Button>
          )}
        </XStack>
      </Stack>
    </Stack>
  );
}
