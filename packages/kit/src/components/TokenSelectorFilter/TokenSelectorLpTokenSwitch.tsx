import { memo } from 'react';

import { ESwitchSize, SizableText, Switch, XStack } from '@onekeyhq/components';

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
  label = 'LP/dApp',
}: ITokenSelectorLpTokenSwitchProps) {
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
        {label}
      </SizableText>
      <Switch
        size={ESwitchSize.small}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </XStack>
  );
}

const TokenSelectorLpTokenSwitch = memo(BasicTokenSelectorLpTokenSwitch);

export { TokenSelectorLpTokenSwitch };
