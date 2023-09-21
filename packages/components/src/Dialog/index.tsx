import { useCallback, useMemo } from 'react';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Adapt, Sheet, Stack, Dialog as TMDialog, YStack } from 'tamagui';

import { Button } from '../Button';
import { type ICON_NAMES, Icon } from '../Icon';
import { XStack } from '../Stack';
import { Text } from '../Text';

import type { GetProps } from 'tamagui';

export interface ModalProps {
  open?: boolean;
  backdrop?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  renderTrigger?: React.ReactNode;
  iconName?: ICON_NAMES;
  title?: string;
  description?: string;
  renderContent?: React.ReactNode;
  confirmButtonProps?: GetProps<typeof Button>;
  cancelButtonProps?: GetProps<typeof Button>;
  confirmButtonTextProps?: GetProps<typeof Button.Text>;
  cancelButtonTextProps?: GetProps<typeof Button.Text>;
}

export function Dialog({
  open,
  onClose,
  renderTrigger,
  onOpen,
  title,
  iconName,
  description,
  renderContent,
  confirmButtonProps,
  confirmButtonTextProps,
  cancelButtonProps,
  cancelButtonTextProps,
  backdrop = false,
}: ModalProps) {
  const backdropClose = useMemo(
    () => (backdrop ? onClose : undefined),
    [backdrop, onClose],
  );
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onClose?.();
      }
    },
    [onClose],
  );

  const { bottom } = useSafeAreaInsets();

  return (
    <TMDialog open={open}>
      <TMDialog.Trigger onPress={onOpen} asChild>
        {renderTrigger}
      </TMDialog.Trigger>

      <Adapt when="md">
        <Sheet
          modal
          dismissOnSnapToBottom
          onOpenChange={handleOpenChange}
          snapPointsMode="fit"
        >
          <Sheet.Overlay
            onPress={backdropClose}
            backgroundColor="$bgBackdrop"
          />
          <Sheet.Handle />
          <Sheet.Frame>
            <Adapt.Contents />
          </Sheet.Frame>
        </Sheet>
      </Adapt>
      <TMDialog.Portal>
        <TMDialog.Overlay
          backgroundColor="$bgBackdrop"
          onPress={backdropClose}
        />
        <TMDialog.Content
          borderRadius="$4"
          borderColor="$borderSubdued"
          borderWidth="$px"
        >
          <YStack
            p="$5"
            mb={bottom}
            $gtMd={{
              width: '$100',
            }}
          >
            <Stack>
              <Icon name={iconName} size="$8" padding="$0.5" />
            </Stack>
            {title && (
              <Text variant="$headingMd" pt="$5">
                {title}
              </Text>
            )}
            {description && (
              <Text variant="$bodyLgMono" pt="$5">
                {description}
              </Text>
            )}
            <YStack pt="$5">{renderContent}</YStack>
            <XStack justifyContent="center" pt="$5">
              <Button
                paddingHorizontal="$3"
                buttonVariant="destructive"
                size="large"
                onPress={onClose}
                {...cancelButtonProps}
              >
                <Button.Text paddingHorizontal="$3" {...cancelButtonTextProps}>
                  Cancel
                </Button.Text>
              </Button>
              <Button
                paddingHorizontal="$3"
                buttonVariant="primary"
                ml="$4"
                size="large"
                onPress={onClose}
                {...confirmButtonProps}
              >
                <Button.Text paddingHorizontal="$3" {...confirmButtonTextProps}>
                  Confirm
                </Button.Text>
              </Button>
            </XStack>
          </YStack>
        </TMDialog.Content>
      </TMDialog.Portal>
    </TMDialog>
  );
}
