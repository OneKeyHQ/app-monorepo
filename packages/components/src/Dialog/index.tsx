import type { ComponentProps } from 'react';

import { Adapt, Sheet, Dialog as TMDialog } from 'tamagui';

import { Button } from '../Button';
import { XStack } from '../Stack';

import type { ICON_NAMES } from '../Icon';

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
  confirmButtonProps?: ComponentProps<typeof Button>;
  cancelButtonProps?: ComponentProps<typeof Button>;
}

export function Dialog({
  open,
  onClose,
  renderTrigger,
  onOpen,
  title,
  description,
  renderContent,
  confirmButtonProps,
  cancelButtonProps,
  backdrop = false,
}: ModalProps) {
  return (
    <TMDialog open={open}>
      <TMDialog.Trigger onPress={onOpen} asChild>
        {renderTrigger}
      </TMDialog.Trigger>

      <Adapt when="md">
        <Sheet
          modal
          dismissOnSnapToBottom
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              onClose?.();
            }
          }}
        >
          <Sheet.Overlay
            onPress={backdrop ? onClose : undefined}
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
          onPress={backdrop ? onClose : undefined}
        />
        <TMDialog.Content>
          <TMDialog.Title>{title}</TMDialog.Title>
          <TMDialog.Description>{description}</TMDialog.Description>
          {renderContent}
          <XStack>
            <Button {...confirmButtonProps} />
            <Button {...cancelButtonProps} />
          </XStack>
        </TMDialog.Content>
      </TMDialog.Portal>
    </TMDialog>
  );
}
