import React, { ComponentProps, FC, useMemo } from 'react';

import { useIntl } from 'react-intl';

import Box from '../../Box';
import Button, { ButtonSize } from '../../Button';
import HStack from '../../HStack';
import { useUserDevice } from '../../Provider/hooks';

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
  const { size } = useUserDevice();

  const defButtonSize = useMemo((): ButtonSize => {
    if (buttonSize) return buttonSize;

    if (['SMALL', 'NORMAL'].includes(size)) {
      return 'lg';
    }
    return 'base';
  }, [buttonSize, size]);

  return (
    <Box flexDirection="row" w="full" mt={marginTop ?? 2}>
      <HStack space="4" w="full">
        {!hideSecondaryAction && (
          <Button
            flex="1"
            onPress={() => {
              onSecondaryActionPress?.();
            }}
            size={secondaryActionProps?.size ?? defButtonSize}
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
            size={primaryActionProps?.size ?? defButtonSize}
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
