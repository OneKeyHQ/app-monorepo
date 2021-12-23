import React, { ComponentProps, FC } from 'react';

import { useIntl } from 'react-intl';

import Box from '../../Box';
import Button from '../../Button';

export type OnCloseCallback = { onClose?: (() => void) | undefined };

export type FooterButtonProps = {
  primaryActionTranslationId?: string;
  secondaryActionTranslationId?: string;
  onPrimaryActionPress?: ({ onClose }: OnCloseCallback) => void;
  onSecondaryActionPress?: () => void;
  hidePrimaryAction?: boolean;
  hideSecondaryAction?: boolean;
  primaryActionProps?: ComponentProps<typeof Button>;
  secondaryActionProps?: ComponentProps<typeof Button>;
};

const FooterButton: FC<FooterButtonProps> = ({
  primaryActionTranslationId,
  secondaryActionTranslationId,
  onPrimaryActionPress,
  onSecondaryActionPress,
  hidePrimaryAction,
  hideSecondaryAction,
  primaryActionProps,
  secondaryActionProps,
}) => {
  const intl = useIntl();
  return (
    <Box flexDirection="row" w="100%">
      {!hideSecondaryAction && (
        <Button
          flex="1"
          onPress={() => {
            onSecondaryActionPress?.();
          }}
          {...secondaryActionProps}
        >
          {intl.formatMessage({
            id: secondaryActionTranslationId ?? 'action__cancel',
          })}
        </Button>
      )}
      {hidePrimaryAction === hideSecondaryAction && <Box w={4} />}
      {!hidePrimaryAction && (
        <Button
          flex={1}
          type="primary"
          {...primaryActionProps}
          onPress={() => onPrimaryActionPress?.({})}
        >
          {intl.formatMessage({
            id: primaryActionTranslationId ?? 'action__ok',
          })}
        </Button>
      )}
    </Box>
  );
};

export default FooterButton;
