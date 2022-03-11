import React, { ComponentProps, FC } from 'react';

import { useIntl } from 'react-intl';

import Box from '../../Box';
import Button, { ButtonSize } from '../../Button';
import HStack from '../../HStack';

export type OnCloseCallback = { onClose?: (() => void) | undefined };

export type FooterButtonProps = {
  primaryActionTranslationId?: string;
  secondaryActionTranslationId?: string;
  onPrimaryActionPress?: ({ onClose }: OnCloseCallback) => void;
  onSecondaryActionPress?: () => void;
  buttonSize?: ButtonSize;
  hidePrimaryAction?: boolean;
  hideSecondaryAction?: boolean;
  primaryActionProps?: ComponentProps<typeof Button>;
  secondaryActionProps?: ComponentProps<typeof Button>;
  marginTop?: number;
};

const FooterButton: FC<FooterButtonProps> = ({
  primaryActionTranslationId,
  secondaryActionTranslationId,
  onPrimaryActionPress,
  onSecondaryActionPress,
  hidePrimaryAction,
  hideSecondaryAction,
  buttonSize,
  primaryActionProps,
  secondaryActionProps,
  marginTop,
}) => {
  const intl = useIntl();
  return (
    <Box flexDirection="row" w="full" mt={marginTop ?? 2}>
      <HStack space="4" w="full">
        {!hideSecondaryAction && (
          <Button
            flex="1"
            onPress={() => {
              onSecondaryActionPress?.();
            }}
            size={secondaryActionProps?.size ?? buttonSize}
            {...secondaryActionProps}
          >
            {secondaryActionProps?.children ??
              intl.formatMessage({
                id: secondaryActionTranslationId ?? 'action__cancel',
              })}
          </Button>
        )}
        {!hidePrimaryAction && (
          <Button
            flex={1}
            type="primary"
            size={primaryActionProps?.size ?? buttonSize}
            {...primaryActionProps}
            onPress={() => onPrimaryActionPress?.({})}
          >
            {primaryActionProps?.children ??
              intl.formatMessage({
                id: primaryActionTranslationId ?? 'action__ok',
              })}
          </Button>
        )}
      </HStack>
    </Box>
  );
};

export default FooterButton;
