import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  SizableText,
  Spinner,
  Switch,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type ITokenSelectorLpTokenSwitchProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
};

function BasicTokenSelectorLpTokenSwitch({
  value,
  onChange,
  disabled,
  loading,
  label,
}: ITokenSelectorLpTokenSwitchProps) {
  const intl = useIntl();
  const displayLabel =
    label ??
    intl.formatMessage({
      id: ETranslations.wallet_defi_tokens__action,
    });
  const thumbProps = useMemo(
    () =>
      loading
        ? {
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            children: (
              <Spinner size="small" color="$iconSubdued" scale={0.65} />
            ),
          }
        : undefined,
    [loading],
  );

  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      minWidth="$10"
      h="$8"
      flexShrink={0}
      gap="$2"
    >
      <SizableText
        size="$bodySm"
        color={disabled || loading ? '$textDisabled' : '$textSubdued'}
        numberOfLines={1}
      >
        {displayLabel}
      </SizableText>
      <Switch
        testID="token-selector-lp-token-switch"
        size={ESwitchSize.extraSmall}
        value={value}
        onChange={onChange}
        disabled={disabled || loading}
        native={false}
        thumbProps={thumbProps}
      />
    </XStack>
  );
}

const TokenSelectorLpTokenSwitch = memo(BasicTokenSelectorLpTokenSwitch);

export { TokenSelectorLpTokenSwitch };
