import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useContext } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Button, Stack, XStack } from '../../primitives';

import { PageContext } from './PageContext';

import type { IButtonProps, IStackProps } from '../../primitives';
import type { IPageNavigationProp } from '../Navigation';

type IActionButtonProps = Omit<IButtonProps, 'children'>;

export type IFooterActionsProps = {
  onConfirm?: (
    close: () => void,
    closePageStack: () => void,
    updateConfirmed: (confirmed: boolean) => void,
  ) => void;
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
  const intl = useIntl();
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
          flexGrow: 1,
          flexBasis: 0,
          size: 'large',
        } as IButtonProps
      }
      onPress={handleCancel}
      testID="page-footer-cancel"
      {...props}
    >
      {children || intl.formatMessage({ id: ETranslations.global_cancel })}
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
  const intl = useIntl();
  const { pop, popStack } = usePageNavigation();
  const { confirmedRef } = useContext(PageContext);

  const updateConfirmedRef = useCallback(
    (confirmed = true) => {
      if (confirmedRef) {
        confirmedRef.current = confirmed;
      }
    },
    [confirmedRef],
  );

  const popCallback = useCallback(() => {
    pop();
    updateConfirmedRef();
  }, [pop, updateConfirmedRef]);

  const popStackCallback = useCallback(() => {
    popStack();
    updateConfirmedRef();
  }, [popStack, updateConfirmedRef]);

  const setConfirmed = useCallback(
    (confirmed: boolean) => {
      setTimeout(() => {
        updateConfirmedRef(confirmed);
      });
    },
    [updateConfirmedRef],
  );

  const handleConfirm = useCallback(() => {
    onConfirm?.(popCallback, popStackCallback, setConfirmed);
    if (confirmedRef) {
      confirmedRef.current = true;
    }
  }, [confirmedRef, onConfirm, popCallback, popStackCallback, setConfirmed]);

  return (
    <Button
      $md={
        {
          flexGrow: 1,
          flexBasis: 0,
          size: 'large',
        } as IButtonProps
      }
      variant="primary"
      onPress={handleConfirm}
      testID="page-footer-confirm"
      {...props}
    >
      {children || intl.formatMessage({ id: ETranslations.global_confirm })}
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
    <Stack p="$5" animation="fast" bg="$bgApp" {...restProps}>
      {children}
      <XStack justifyContent="flex-end" space="$2.5" {...buttonContainerProps}>
        {renderCancelButton()}
        {renderConfirmButton()}
      </XStack>
    </Stack>
  );
}
