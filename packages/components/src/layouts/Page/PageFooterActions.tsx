import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';

import { getTokenValue } from '../../hooks';
import { Button, Stack, XStack } from '../../primitives';

import type { IButtonProps, IStackProps } from '../../primitives';
import type { IPageNavigationProp } from '../Navigation';

type IActionButtonProps = Omit<IButtonProps, 'children'>;

export type IFooterActionsProps = {
  onConfirm?: (close: () => void, closePageStack: () => void) => void;
  onCancel?: (
    close: () => void,
    closePageStack: () => void,
  ) => void | Promise<void>;
  onConfirmText?: string;
  onCancelText?: string;
  confirmButtonProps?: IActionButtonProps;
  cancelButtonProps?: IActionButtonProps;
  /** use Page.cancelButton */
  cancelButton?: ReactElement;
  /** use Page.confirmButton */
  confirmButton?: ReactElement;
  buttonContainerProps?: IStackProps;
} & IStackProps;

const usePageNavigation = () => {
  const navigation = useNavigation<IPageNavigationProp<any>>();
  const popStack = useCallback(() => {
    navigation.getParent()?.goBack?.();
  }, [navigation]);

  const pop = useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack?.();
    } else {
      popStack();
    }
  }, [navigation, popStack]);

  return {
    pop,
    popStack,
  };
};

export function FooterCancelButton({
  children,
  onCancel,
  ...props
}: IButtonProps & {
  onCancel: IFooterActionsProps['onCancel'];
}) {
  const { pop, popStack } = usePageNavigation();
  const handleCancel = useCallback(async () => {
    await onCancel?.(pop, popStack);
    if (!onCancel?.length) {
      pop();
    }
  }, [onCancel, pop, popStack]);
  return (
    <Button
      $md={
        {
          flex: 1,
          size: 'large',
        } as IButtonProps
      }
      onPress={handleCancel}
      {...props}
    >
      {children || 'Cancel'}
    </Button>
  );
}

export function FooterConfirmButton({
  onConfirm,
  children,
  ...props
}: IButtonProps & {
  onConfirm: IFooterActionsProps['onConfirm'];
}) {
  const { pop, popStack } = usePageNavigation();

  const handleConfirm = useCallback(() => {
    onConfirm?.(pop, popStack);
  }, [onConfirm, pop, popStack]);
  return (
    <Button
      $md={
        {
          flex: 1,
          size: 'large',
        } as IButtonProps
      }
      variant="primary"
      onPress={handleConfirm}
      {...props}
    >
      {children || 'Confirm'}
    </Button>
  );
}

export function FooterActions({
  onCancel,
  onCancelText,
  onConfirm,
  onConfirmText,
  confirmButtonProps,
  cancelButtonProps,
  buttonContainerProps,
  children,
  cancelButton,
  confirmButton,
  ...restProps
}: PropsWithChildren<IFooterActionsProps>) {
  const renderCancelButton = useCallback(() => {
    if (cancelButton) {
      return cancelButton;
    }
    return !!cancelButtonProps || !!onCancel ? (
      <FooterCancelButton onCancel={onCancel} {...cancelButtonProps}>
        {onCancelText}
      </FooterCancelButton>
    ) : null;
  }, [cancelButton, cancelButtonProps, onCancel, onCancelText]);
  const renderConfirmButton = useCallback(() => {
    if (confirmButton) {
      return confirmButton;
    }
    return !!confirmButtonProps || !!onConfirm ? (
      <FooterConfirmButton onConfirm={onConfirm} {...confirmButtonProps}>
        {onConfirmText}
      </FooterConfirmButton>
    ) : null;
  }, [confirmButton, confirmButtonProps, onConfirm, onConfirmText]);
  return (
    <Stack
      p="$5"
      animation="fast"
      pb={getTokenValue('$size.5') as number}
      bg="$bgApp"
      {...restProps}
    >
      {children}
      <XStack justifyContent="flex-end" space="$2.5" {...buttonContainerProps}>
        {renderCancelButton()}
        {renderConfirmButton()}
      </XStack>
    </Stack>
  );
}
