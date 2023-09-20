import type { ComponentProps } from 'react';

import { Adapt, Sheet, Dialog as TMDialog, Text } from 'tamagui';

import { XStack } from '../Stack';

import type { Button } from '../Button';
import type { ICON_NAMES } from '../Icon';

export interface ModalProps {
  open?: boolean;
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
}: ModalProps) {
  return (
    <TMDialog open={open}>
      <TMDialog.Trigger onPress={onOpen} asChild>
        {renderTrigger}
      </TMDialog.Trigger>
      <Adapt when="xl" platform="touch">
        <Sheet modal zIndex={20000}>
          <Sheet.Handle />
          <Sheet.Frame>
            <Adapt.Contents />
          </Sheet.Frame>
          <Sheet.Overlay
            backgroundColor="$bgBackdrop"
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
        </Sheet>
      </Adapt>
      {/* <TMDialog.Portal>
        <TMDialog.Overlay backgroundColor="$bgBackdrop" onPress={onClose} />
        <TMDialog.Content>
          <TMDialog.Title>{title}</TMDialog.Title>
          <TMDialog.Description>{description}</TMDialog.Description>
          {renderContent}
        </TMDialog.Content>
        <XStack>
          <Button {...confirmButtonProps} />
          <Button {...cancelButtonProps} />
        </XStack>
      </TMDialog.Portal> */}

      {/* optionally change to sheet when small screen */}
    </TMDialog>
  );
}
