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

import type { ButtonProps } from '../Button';
import type { FormProps } from '../Form';
import type { UseFormProps, UseFormReturn } from 'react-hook-form';
import type {
  DialogProps as TMDialogProps,
  SheetProps as TMSheetProps,
} from 'tamagui';

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

export interface DialogProps extends TMDialogProps {
  onOpen?: () => void;
  onClose?: () => void;
  renderTrigger?: React.ReactNode;
  icon?: ICON_NAMES;
  title?: string;
  description?: string;
  tone?: 'default' | 'destructive';
  renderContent?: React.ReactNode;
  showFooter?: boolean;
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  confirmButtonProps?: ButtonProps;
  cancelButtonProps?: ButtonProps;
  dismissOnOverlayPress?: TMSheetProps['dismissOnOverlayPress'];
  sheetProps?: Omit<TMSheetProps, 'dismissOnOverlayPress'>;
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
  showFooter = true,
  onConfirm,
  onCancel,
  tone,
  confirmButtonProps,
  cancelButtonProps,
  dismissOnOverlayPress = true,
  sheetProps,
}: DialogProps) {
  const [position, setPosition] = useState(0);
  const handleBackdropPress = useMemo(
    () => (dismissOnOverlayPress ? onClose : undefined),
    [dismissOnOverlayPress, onClose],
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
    <Stack {...(bottom && { pb: bottom })}>
      {icon && (
        <Stack
          alignSelf="flex-start"
          p="$3"
          ml="$5"
          mt="$5"
          borderRadius="$full"
          bg={tone === 'destructive' ? '$bgCritical' : '$bgStrong'}
        >
          <Icon
            name={icon}
            size="$8"
            color={tone === 'destructive' ? '$iconCritical' : '$icon'}
          />
        </Stack>
      )}
      <Stack p="$5" pr="$16">
        <Text variant="$headingXl" py="$px">
          {title}
        </Text>
        {description && (
          <Text variant="$bodyLg" pt="$1.5">
            {description}
          </Text>
        )}
      </Stack>
      <IconButton
        position="absolute"
        right="$5"
        top="$5"
        icon="CrossedSmallOutline"
        iconProps={{
          color: '$iconSubdued',
        }}
        size="small"
        onPress={handleCancelButtonPress}
      />
      {renderContent && (
        <YStack px="$5" pb="$5">
          {renderContent}
        </YStack>
      )}
      {showFooter && (
        <XStack p="$5" pt="$0">
          <Button
            flex={1}
            $md={
              {
                size: 'large',
              } as ButtonProps
            }
            {...cancelButtonProps}
            onPress={handleCancelButtonPress}
          >
            Cancel
          </Button>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'primary'}
            flex={1}
            ml="$2.5"
            $md={
              {
                size: 'large',
              } as ButtonProps
            }
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
          dismissOnSnapToBottom
          dismissOnOverlayPress={dismissOnOverlayPress}
          onOpenChange={handleOpenChange}
          snapPointsMode="fit"
          animation="quick"
          {...sheetProps}
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
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          backgroundColor="$bgBackdrop"
          onPress={handleBackdropPress}
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
          outlineWidth="$px"
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
  useFormProps?: UseFormProps<any>;
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
  const formContext = useForm((useFormProps as any) || {});
  const { setContext } = useContext(DialogContext);
  useEffect(() => {
    setContext?.({ form: formContext });
  }, [formContext, setContext]);
  const element =
    typeof children === 'function'
      ? (children as (props: { form: UseFormReturn<any> }) => ReactNode)({
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
  { name: string } & Omit<DialogProps, 'onConfirm'> & {
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
