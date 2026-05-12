import { memo } from 'react';

import { ESwitchSize, Switch, XStack } from '@onekeyhq/components';

type ITokenSelectorLpTokenSwitchProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

function BasicTokenSelectorLpTokenSwitch({
  value,
  onChange,
  disabled,
}: ITokenSelectorLpTokenSwitchProps) {
  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      minWidth="$10"
      minHeight="$8"
      flexShrink={0}
    >
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
