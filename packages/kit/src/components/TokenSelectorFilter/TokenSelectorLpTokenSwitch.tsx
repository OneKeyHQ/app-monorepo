import { memo } from 'react';

import { useIntl } from 'react-intl';

import { ESwitchSize, SizableText, Switch, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type ITokenSelectorLpTokenSwitchProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
};

function BasicTokenSelectorLpTokenSwitch({
  value,
  onChange,
  disabled,
  label,
}: ITokenSelectorLpTokenSwitchProps) {
  const intl = useIntl();
  const displayLabel =
    label ??
    intl.formatMessage({
      id: ETranslations.wallet_defi_tokens__action,
    });

  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      minWidth="$10"
      minHeight="$8"
      flexShrink={0}
      gap="$2"
    >
      <SizableText
        size="$bodySm"
        color={disabled ? '$textDisabled' : '$textSubdued'}
        numberOfLines={1}
      >
        {displayLabel}
      </SizableText>
      <Switch
        testID="token-selector-lp-token-switch"
        size={ESwitchSize.extraSmall}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </XStack>
  );
}

const TokenSelectorLpTokenSwitch = memo(BasicTokenSelectorLpTokenSwitch);

export { TokenSelectorLpTokenSwitch };
