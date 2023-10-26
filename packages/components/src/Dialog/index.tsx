import type {
  Dispatch,
  PropsWithChildren,
  ReactNode,
  SetStateAction,
} from 'react';
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Sheet,
  Dialog as TMDialog,
  composeEventHandlers,
  useMedia,
  withStaticProperties,
} from 'tamagui';

import { Button } from '../Button';
import { Form, useForm } from '../Form';
import useKeyboardHeight from '../hooks/useKeyboardHeight';
import { type ICON_NAMES, Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { removePortalComponent, setPortalComponent } from '../Portal';
import { Stack, XStack, YStack } from '../Stack';
import { Text } from '../Text';

import type { FormProps } from '../Form';
import type { UseFormReturn } from 'react-hook-form';
import type { ButtonProps, GetProps } from 'tamagui';

function Trigger({
  onOpen,
  children,
}: PropsWithChildren<{ onOpen?: () => void }>) {
  if (children) {
    const child = Children.only(children);
    if (isValidElement(child)) {
      const handleOpen = (child.props as ButtonProps).onPress
        ? composeEventHandlers((child.props as ButtonProps).onPress, onOpen)
        : onOpen;
      if (child.type === Button) {
        return cloneElement(child, { onPress: handleOpen } as ButtonProps);
      }
      return <Stack onPress={handleOpen}>{children}</Stack>;
    }
  }
  return null;
}

export interface ModalProps {
  open?: boolean;
  backdrop?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  renderTrigger?: React.ReactNode;
  icon?: ICON_NAMES;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  renderContent?: React.ReactNode;
  renderFooter?: React.ReactNode;
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  confirmButtonProps?: GetProps<typeof Button>;
  cancelButtonProps?: GetProps<typeof Button>;
  dismissOnSnapToBottom?: boolean;
}

function DialogFrame({
  open,
  onClose,
  renderTrigger,
  onOpen,
  title,
  icon,
  description,
  renderContent,
  renderFooter,
  onConfirm,
  onCancel,
  variant,
  confirmButtonProps,
  cancelButtonProps,
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
  const keyboardHeight = useKeyboardHeight();

  const content = (
    <Stack p="$5" pb={bottom || '$5'}>
      {icon && (
        <Stack
          p="$3"
          borderRadius="$full"
          bg={variant === 'destructive' ? '$bgCritical' : '$bgStrong'}
        >
          <Icon
            name={icon}
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
        <IconButton
          icon="CrossedSmallOutline"
          size="small"
          onPress={handleCancelButtonPress}
        />
      </XStack>
      {renderContent && <YStack pt="$5">{renderContent}</YStack>}
      {renderFooter !== undefined ? (
        renderFooter
      ) : (
        <XStack justifyContent="center" pt="$5">
          <Button
            flex={1}
            $md={{
              size: 'large',
            }}
            {...cancelButtonProps}
            onPress={handleCancelButtonPress}
          >
            Cancel
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'primary'}
            flex={1}
            ml="$2.5"
            $md={{
              size: 'large',
            }}
            {...confirmButtonProps}
            onPress={handleConfirmButtonPress}
          >
            Confirm
          </Button>
        </XStack>
      )}
    </Stack>
  );
  if (media.md) {
    return (
      <>
        <Trigger onOpen={onOpen}>{renderTrigger}</Trigger>
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
            unstyled
            borderTopLeftRadius="$6"
            borderTopRightRadius="$6"
            bg="$bg"
            paddingBottom={keyboardHeight}
          >
            {/* grabber */}
            <Stack
              position="absolute"
              top={0}
              width="100%"
              py="$1"
              alignItems="center"
            >
              <Stack
                width="$9"
                height="$1"
                bg="$neutral5"
                borderRadius="$full"
              />
            </Stack>
            {content}
          </Sheet.Frame>
        </Sheet>
      </>
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
  const element =
    typeof children === 'function'
      ? (children as (props: { form: UseFormReturn<unknown> }) => ReactNode)({
          form: formContext,
        })
      : children;
  return (
    <Form {...props} form={formContext}>
      {element}
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
