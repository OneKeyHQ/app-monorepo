import type { PropsWithChildren } from 'react';
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

export function FooterActions({
  onCancel,
  onCancelText,
  onConfirm,
  onConfirmText,
  confirmButtonProps,
  cancelButtonProps,
  buttonContainerProps,
  children,
  ...restProps
}: PropsWithChildren<IFooterActionsProps>) {
  const { pop, popStack } = usePageNavigation();
  const handleCancel = useCallback(async () => {
    await onCancel?.(pop, popStack);
    if (!onCancel?.length) {
      pop();
    }
  }, [onCancel, pop, popStack]);

  const handleConfirm = useCallback(() => {
    onConfirm?.(pop, popStack);
  }, [onConfirm, pop, popStack]);
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
        {(!!cancelButtonProps || !!onCancel) && (
          <Button
            $md={
              {
                flex: 1,
                size: 'large',
              } as IButtonProps
            }
            onPress={handleCancel}
            {...cancelButtonProps}
          >
            {onCancelText || 'Cancel'}
          </Button>
        )}
        {(!!confirmButtonProps || !!onConfirm) && (
          <Button
            $md={
              {
                flex: 1,
                size: 'large',
              } as IButtonProps
            }
            variant="primary"
            onPress={handleConfirm}
            {...confirmButtonProps}
          >
            {onConfirmText || 'Confirm'}
          </Button>
        )}
      </XStack>
    </Stack>
  );
}
