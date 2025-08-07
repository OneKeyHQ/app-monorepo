import { useIntl } from 'react-intl';

import { Button, SizableText } from '@onekeyhq/components';
import type { ETranslations } from '@onekeyhq/shared/src/locale';

export interface IMarketViewToggleProps {
  disabled?: boolean;
}

export interface IToggleButtonProps {
  isActive: boolean;
  onPress: (() => void) | undefined;
  disabled: boolean;
  translationId: ETranslations;
  defaultMessage: string;
}

export function ToggleButton({
  isActive,
  onPress,
  disabled,
  translationId,
  defaultMessage,
}: IToggleButtonProps) {
  const intl = useIntl();

  return (
    <Button
      variant="tertiary"
      onPress={onPress}
      bg={isActive ? '$bgHover' : '$transparent'}
      disabled={disabled}
    >
      <SizableText
        size="$bodyLgMedium"
        color={isActive ? '$text' : '$textSubdued'}
      >
        {intl.formatMessage({
          id: translationId,
          defaultMessage,
        })}
      </SizableText>
    </Button>
  );
}

export function MarketViewToggle(props: IMarketViewToggleProps) {
  return null; // Placeholder implementation
}
