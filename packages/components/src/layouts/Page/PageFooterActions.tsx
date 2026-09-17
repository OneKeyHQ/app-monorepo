import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useContext } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Button, Stack, XStack } from '../../primitives';

import { PageContext } from './PageContext';

import type { IButtonProps, IStackProps, IXStackProps } from '../../primitives';
import type { IPageNavigationProp } from '../Navigation';

type IActionButtonProps = Omit<IButtonProps, 'children'>;

const cancelButtonMdStyle = {
  flexGrow: 1,
  flexBasis: 0,
  size: 'large',
} as any;

const confirmButtonMdStyle = {
  flexGrow: 1,
  flexBasis: 0,
  size: 'large',
} as any;

// Stacked buttons keep their natural height: the row's equal split
// (flexGrow 1, flexBasis 0) would act on the height in a column and
// collapse each button to its padding.
const stackedButtonMdStyle = {
  size: 'large',
} as any;

const stackedButtonContainerMdStyle = {
  flexDirection: 'column-reverse',
  gap: '$3',
} as const;

const footerActionsGtMdStyle = {
  flexDirection: 'row',
  alignItems: 'center',
} as const;

const footerButtonContainerGtMdStyle = {
  ml: 'auto',
} as any;

export type IFooterActionsProps = {
  onConfirm?: (
    close: (extra?: { flag?: string }) => void,
    closePageStack: (extra?: { flag?: string }) => void,
  ) => void;
  onCancel?: (
    close: (extra?: { flag?: string }) => void,
    closePageStack: (extra?: { flag?: string }) => void,
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
  /**
   * Below md, stack the buttons with the primary action on top instead of
   * the equal-width row. Wider layouts keep the row.
   */
  stacked?: boolean;
} & IStackProps;

const usePageNavigation = () => {
  const navigation = useNavigation<IPageNavigationProp<any>>();

  const { closeExtraRef } = useContext(PageContext);

  const updateExtraRef = useCallback(
    (extra?: { flag?: string }) => {
      if (closeExtraRef && extra) {
        closeExtraRef.current = extra;
      }
    },
    [closeExtraRef],
  );

  const popStack = useCallback(
    (extra?: { flag?: string }) => {
      navigation.getParent()?.goBack?.();
      updateExtraRef(extra);
    },
    [navigation, updateExtraRef],
  );

  const pop = useCallback(
    (extra?: { flag?: string }) => {
      if (navigation.canGoBack?.()) {
        navigation.goBack?.();
      } else {
        popStack();
      }
      updateExtraRef(extra);
    },
    [navigation, popStack, updateExtraRef],
  );

  return {
    pop,
    popStack,
  };
};

export function FooterCancelButton({
  children,
  onCancel,
  stacked,
  ...props
}: IButtonProps & {
  onCancel: IFooterActionsProps['onCancel'];
  stacked?: boolean;
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
      $md={stacked ? stackedButtonMdStyle : cancelButtonMdStyle}
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
  stacked,
  ...props
}: IButtonProps & {
  onConfirm: IFooterActionsProps['onConfirm'];
  stacked?: boolean;
}) {
  const intl = useIntl();
  const { pop, popStack } = usePageNavigation();

  const handleConfirm = useCallback(() => {
    onConfirm?.(pop, popStack);
  }, [onConfirm, pop, popStack]);

  return (
    <Button
      $md={stacked ? stackedButtonMdStyle : confirmButtonMdStyle}
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
  stacked,
  ...restProps
}: PropsWithChildren<IFooterActionsProps>) {
  const renderCancelButton = useCallback(() => {
    if (cancelButton) {
      return cancelButton;
    }
    return !!cancelButtonProps || !!onCancel ? (
      <FooterCancelButton
        onCancel={onCancel}
        stacked={stacked}
        {...cancelButtonProps}
      >
        {onCancelText}
      </FooterCancelButton>
    ) : null;
  }, [cancelButton, cancelButtonProps, onCancel, onCancelText, stacked]);
  const renderConfirmButton = useCallback(() => {
    if (confirmButton) {
      return confirmButton;
    }
    return !!confirmButtonProps || !!onConfirm ? (
      <FooterConfirmButton
        onConfirm={onConfirm}
        stacked={stacked}
        {...confirmButtonProps}
      >
        {onConfirmText}
      </FooterConfirmButton>
    ) : null;
  }, [confirmButton, confirmButtonProps, onConfirm, onConfirmText, stacked]);
  return (
    <Stack p="$5" $gtMd={footerActionsGtMdStyle} bg="$bgApp" {...restProps}>
      {children}
      <XStack
        gap="$2.5"
        $gtMd={footerButtonContainerGtMdStyle}
        {...(stacked ? { $md: stackedButtonContainerMdStyle } : {})}
        {...(buttonContainerProps as IXStackProps)}
      >
        {renderCancelButton()}
        {renderConfirmButton()}
      </XStack>
    </Stack>
  );
}
