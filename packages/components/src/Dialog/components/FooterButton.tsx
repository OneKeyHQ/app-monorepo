import type { ComponentProps, FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useUserDevice } from '@onekeyhq/components';

import Box from '../../Box';
import Button from '../../Button';

import type { ButtonSize } from '../../Button';
import type { LocaleIds } from '../../locale';

export type OnCloseCallback = { onClose?: (() => void) | undefined };

export type FooterButtonProps = {
  primaryActionTranslationId?: LocaleIds;
  secondaryActionTranslationId?: LocaleIds;
  onPrimaryActionPress?: ({ onClose }: OnCloseCallback) => void;
  onSecondaryActionPress?: () => void;
  buttonSize?: ButtonSize;
  hidePrimaryAction?: boolean;
  hideSecondaryAction?: boolean;
  primaryActionProps?: ComponentProps<typeof Button>;
  secondaryActionProps?: ComponentProps<typeof Button>;
  marginTop?: number;
  wrap?: boolean;
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
  wrap,
}) => {
  const intl = useIntl();
  const { size } = useUserDevice();

  const defButtonSize = useMemo((): ButtonSize => {
    if (buttonSize) return buttonSize;

    if (['SMALL', 'NORMAL'].includes(size)) {
      return 'xl';
    }
    return 'base';
  }, [buttonSize, size]);

  return (
    <Box flexDirection="row" w="full" mt={marginTop ?? 6}>
      <Box w="full" flexDirection={wrap ? 'column-reverse' : 'row'}>
        {!hideSecondaryAction && (
          <Button
            flexGrow={wrap ? 0 : 1}
            onPress={() => {
              onSecondaryActionPress?.();
            }}
            size={secondaryActionProps?.size ?? defButtonSize}
            {...secondaryActionProps}
            type={wrap ? 'plain' : 'basic'}
          >
            {secondaryActionProps?.children ??
              intl.formatMessage({
                id: secondaryActionTranslationId ?? 'action__cancel',
              })}
          </Button>
        )}
        <Box size={wrap ? 2 : 4} />
        {!hidePrimaryAction && (
          <Button
            flexGrow={wrap ? 0 : 1}
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
      </Box>
    </Box>
  );
};

export default FooterButton;
