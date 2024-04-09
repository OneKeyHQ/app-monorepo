import type { ComponentProps, FC } from 'react';
import { useCallback, useMemo } from 'react';

import type { Input } from '@onekeyhq/components';
import { Icon, SizableText, Stack } from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';

type IChainSelectorInputProps = Pick<
  ComponentProps<typeof Input>,
  'value' | 'disabled' | 'error' | 'editable' | 'size'
> & {
  networkIds?: string[];
  testID?: string;
  onChange?: (value: string) => void;
  title?: string;
} & ComponentProps<typeof Stack>;

export const ChainSelectorInput: FC<IChainSelectorInputProps> = ({
  value,
  disabled,
  error,
  editable,
  size,
  onChange,
  title,
  ...rest
}) => {
  const { result } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getAllNetworks(),
    [],
    { initResult: { networks: [] } },
  );
  const current = useMemo(() => {
    const item = result.networks.find((o) => o.id === value);
    return item || result.networks[0];
  }, [result, value]);

  const sharedStyles = getSharedInputStyles({
    disabled,
    error,
    editable,
    size,
  });

  const openChainSelector = useConfigurableChainSelector();

  const onPress = useCallback(() => {
    openChainSelector({
      title,
      defaultNetworkId: current.id,
      onSelect: (network) => onChange?.(network.id),
    });
  }, [openChainSelector, current, onChange, title]);
  return (
    <Stack
      {...sharedStyles}
      position="relative"
      onPress={disabled ? undefined : onPress}
      flexDirection="row"
      alignItems="center"
      testID="network-selector-input"
      {...rest}
    >
      <Token tokenImageUri={current?.logoURI} size="sm" />
      <SizableText
        px={sharedStyles.px}
        flex={1}
        size={size === 'small' ? '$bodyMd' : '$bodyLg'}
      >
        {current?.name ?? ''}
      </SizableText>
      <Icon name="ChevronGrabberVerOutline" />
    </Stack>
  );
};
