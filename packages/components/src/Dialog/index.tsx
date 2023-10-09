import type { Dispatch, PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Sheet,
  Dialog as TMDialog,
  useMedia,
  withStaticProperties,
} from 'tamagui';

import { Button } from '../Button';
import { Form, useForm } from '../Form';
import { type ICON_NAMES, Icon } from '../Icon';
import { removePortalComponent, setPortalComponent } from '../Portal';
import { Stack, XStack, YStack } from '../Stack';
import { Text } from '../Text';

import type { FormProps } from '../Form';
import type { SetStateAction } from 'jotai';
import type { UseFormReturn } from 'react-hook-form';
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
  iconName,
  description,
  renderContent,
  onConfirm,
  onCancel,
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
          {...cancelButtonProps}
          onPress={handleCancelButtonPress}
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
          {...confirmButtonProps}
          onPress={handleConfirmButtonPress}
        >
          <Button.Text paddingHorizontal="$3" {...confirmButtonTextProps}>
            Confirm
          </Button.Text>
        </Button>
      </XStack>
    </YStack>
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
      >
        <Sheet.Overlay
          animation="lazy"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          backgroundColor="$bgBackdrop"
        />
        <Sheet.Handle
          marginHorizontal="auto"
          width="$20"
          height="$1"
          backgroundColor="rgba(255, 255, 255, 0.5)"
        />
        <Sheet.Frame>{content}</Sheet.Frame>
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
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          borderRadius="$4"
          borderColor="$borderSubdued"
          borderWidth="$px"
        >
          {content}
        </TMDialog.Content>
      </TMDialog.Portal>
    </TMDialog>
  );
}

type DialogFormProps = Omit<FormProps, 'form'> & {
  useFormProps: Parameters<typeof useForm>;
};
export const DialogContext = createContext<{
  context?: { form?: UseFormReturn<any> };
  setContext?: Dispatch<
    SetStateAction<{
      form?: UseFormReturn<any> | undefined;
    }>
  >;
}>({});

function DialogForm({ useFormProps, children, ...props }: DialogFormProps) {
  const formContext = useForm(useFormProps as any);
  const { setContext } = useContext(DialogContext);
  useEffect(() => {
    setContext?.({ form: formContext });
  }, [formContext, setContext]);
  return (
    <Form {...props} form={formContext}>
      {children}
    </Form>
  );
}

type DialogContainerProps = PropsWithChildren<
  { name: string } & Omit<ModalProps, 'onConfirm'> & {
      onConfirm?: (context: {
        form?: UseFormReturn<any> | undefined;
      }) => void | Promise<boolean>;
    }
>;

function DialogContainer({
  name,
  onOpen,
  onClose,
  renderContent,
  onConfirm,
  ...props
}: DialogContainerProps) {
  const [isOpen, changeIsOpen] = useState(true);
  const [context, setContext] = useState<{ form?: UseFormReturn<any> }>({});
  const contextValue = useMemo(
    () => ({
      context,
      setContext,
    }),
    [context],
  );
  const handleOpen = useCallback(() => {
    changeIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const handleClose = useCallback(() => {
    changeIsOpen(false);
    onClose?.();
    removePortalComponent(name);
  }, [name, onClose]);

  const handleConfirm = useCallback(
    () => onConfirm?.(context),
    [context, onConfirm],
  );

  const handleConfirm = useCallback(
    () => onConfirm?.(context),
    [context, onConfirm],
  );

  return (
    <DialogContext.Provider key={name} value={contextValue}>
      <DialogFrame
        open={isOpen}
        onOpen={handleOpen}
        renderContent={renderContent}
        onClose={handleClose}
        {...props}
        onConfirm={handleConfirm}
      />
    </DialogContext.Provider>
  );
}

function DialogConfirm(props: Omit<DialogContainerProps, 'name'>) {
  setPortalComponent(
    <DialogContainer {...props} name={Math.random().toString()} />,
  );
}

export const Dialog = withStaticProperties(DialogFrame, {
  confirm: DialogConfirm,
  Form: DialogForm,
  FormField: Form.Field,
});
