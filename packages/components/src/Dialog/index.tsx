import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Sheet,
  Dialog as TMDialog,
  useMedia,
  withStaticProperties,
} from 'tamagui';

import { Button } from '../Button';
import { type ICON_NAMES, Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { removePortalComponent, setPortalComponent } from '../Portal';
import { Stack, XStack, YStack } from '../Stack';
import { Text } from '../Text';

import type { GetProps } from 'tamagui';

export interface ModalProps {
  open?: boolean;
  backdrop?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  renderTrigger?: React.ReactNode;
  leadingIcon?: ICON_NAMES;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  renderContent?: React.ReactNode;
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  confirmButtonProps?: GetProps<typeof Button>;
  cancelButtonProps?: GetProps<typeof Button>;
  confirmButtonTextProps?: GetProps<typeof Button.Text>;
  cancelButtonTextProps?: GetProps<typeof Button.Text>;
  dismissOnSnapToBottom?: boolean;
}

function DialogFrame({
  open,
  onClose,
  renderTrigger,
  onOpen,
  title,
  leadingIcon,
  description,
  renderContent,
  onConfirm,
  onCancel,
  variant,
  confirmButtonProps,
  confirmButtonTextProps,
  cancelButtonProps,
  cancelButtonTextProps,
  backdrop = false,
  dismissOnSnapToBottom = true,
}: ModalProps) {
  const [position, setPosition] = useState(0);
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
  const handleConfirmButtonPress = useCallback(async () => {
    const result = await onConfirm?.();
    if (result || result === undefined) {
      onClose?.();
    }
  }, [onConfirm, onClose]);

  const handleCancelButtonPress = useCallback(() => {
    onCancel?.();
    onClose?.();
  }, [onCancel, onClose]);

  const media = useMedia();

  const content = (
    <Stack p="$5" pb={bottom || '$5'}>
      {leadingIcon && (
        <Stack
          p="$3"
          borderRadius="$full"
          bg={variant === 'destructive' ? '$bgCritical' : '$bgStrong'}
        >
          <Icon
            name={leadingIcon}
            size="$8"
            color={variant === 'destructive' ? '$iconCritical' : '$icon'}
          />
        </Stack>
      )}
      <XStack alignItems="flex-start">
        <Stack flex={1} pr="$2.5">
          {title && (
            <Text variant="$headingXl" py="$px">
              {title}
            </Text>
          )}
          {description && (
            <Text variant="$bodyLg" pt="$1.5">
              {description}
            </Text>
          )}
        </Stack>
        <IconButton size="small" onPress={handleCancelButtonPress}>
          <IconButton.Icon name="CrossedSmallOutline" />
        </IconButton>
      </XStack>
      {renderContent && <YStack pt="$5">{renderContent}</YStack>}
      <XStack justifyContent="center" pt="$5">
        <Button
          buttonVariant="secondary"
          flex={1}
          size="medium"
          $md={{
            size: 'large',
          }}
          {...cancelButtonProps}
          onPress={handleCancelButtonPress}
        >
          <Button.Text paddingHorizontal="$3" {...cancelButtonTextProps}>
            Cancel
          </Button.Text>
        </Button>
        <Button
          buttonVariant={variant === 'destructive' ? 'destructive' : 'primary'}
          flex={1}
          ml="$2.5"
          size="medium"
          $md={{
            size: 'large',
          }}
          {...confirmButtonProps}
          onPress={handleConfirmButtonPress}
        >
          <Button.Text paddingHorizontal="$3" {...confirmButtonTextProps}>
            Confirm
          </Button.Text>
        </Button>
      </XStack>
    </Stack>
  );
  if (media.md) {
    return (
      <Sheet
        modal
        open={open}
        position={position}
        onPositionChange={setPosition}
        dismissOnSnapToBottom={dismissOnSnapToBottom}
        dismissOnOverlayPress={backdrop}
        onOpenChange={handleOpenChange}
        snapPointsMode="fit"
        animation="quick"
      >
        <Sheet.Overlay
          animation="quick"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          backgroundColor="$bgBackdrop"
        />
        <Sheet.Frame
          borderTopLeftRadius="$6"
          borderTopRightRadius="$6"
          bg="$bg"
        >
          {/* grabber */}
          <Stack
            position="absolute"
            top={0}
            width="100%"
            py="$1"
            alignItems="center"
          >
            <Stack width="$9" height="$1" bg="$neutral5" borderRadius="$full" />
          </Stack>
          {content}
        </Sheet.Frame>
      </Sheet>
    );
  }

  return (
    <TMDialog modal open={open}>
      <TMDialog.Trigger onPress={onOpen} asChild>
        {renderTrigger}
      </TMDialog.Trigger>
      <TMDialog.Portal>
        <TMDialog.Overlay
          key="overlay"
          animation="quick"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          backgroundColor="$bgBackdrop"
          onPress={backdropClose}
        />
        <TMDialog.Content
          elevate
          key="content"
          animateOnly={['transform', 'opacity']}
          animation={[
            'quick',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ opacity: 0, scale: 0.95 }}
          exitStyle={{ opacity: 0, scale: 0.95 }}
          borderRadius="$4"
          borderWidth="$0"
          outlineColor="$borderSubdued"
          outlineStyle="solid"
          outlineWidth={StyleSheet.hairlineWidth}
          bg="$bg"
          width={400}
          p="$0"
        >
          {content}
        </TMDialog.Content>
      </TMDialog.Portal>
    </TMDialog>
  );
}

function DialogContainer({
  name,
  onOpen,
  onClose,
  renderContent,
  ...props
}: PropsWithChildren<{ name: string } & ModalProps>) {
  const [isOpen, changeIsOpen] = useState(true);
  useEffect(() => () => {
    // Remove the React node after the animation has finished.
    setTimeout(() => {
      removePortalComponent(name);
    }, 300);
  });
  const handleOpen = useCallback(() => {
    changeIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const handleClose = useCallback(() => {
    changeIsOpen(false);
    onClose?.();
  }, [onClose]);

  return (
    <DialogFrame
      key={name}
      open={isOpen}
      onOpen={handleOpen}
      renderContent={renderContent}
      onClose={handleClose}
      {...props}
    />
  );
}

export const Dialog = withStaticProperties(DialogFrame, {
  confirm: (props: ModalProps) => {
    setPortalComponent(
      <DialogContainer {...props} name={Math.random().toString()} />,
    );
  },
});
