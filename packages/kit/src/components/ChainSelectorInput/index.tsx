import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import type { Input } from '@onekeyhq/components';
import { Icon, SizableText, Stack } from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';

import { NetworkAvatar } from '../NetworkAvatar';

export type IChainSelectorInputProps = Pick<
  ComponentProps<typeof Input>,
  'value' | 'disabled' | 'error' | 'editable' | 'size'
> & {
  networkIds?: string[];
  testID?: string;
  onChange?: (value: string) => void;
  title?: string;
  excludeAllNetworkItem?: boolean;
  miniMode?: boolean;
} & ComponentProps<typeof Stack>;

export const ChainSelectorInput: FC<IChainSelectorInputProps> = ({
  value,
  disabled,
  error,
  editable,
  size,
  onChange,
  title,
  networkIds,
  excludeAllNetworkItem,
  miniMode,
  ...rest
}) => {
  const { result: selectorNetworks } = usePromiseResult(
    async () => {
      const { networks } =
        await backgroundApiProxy.serviceNetwork.getAllNetworks({
          excludeAllNetworkItem,
        });
      if (networkIds && networkIds.length > 0) {
        return networks.filter((o) => networkIds.includes(o.id));
      }
      return networks;
    },
    [excludeAllNetworkItem, networkIds],
    { initResult: [] },
  );

  const current = useMemo(() => {
    const item = selectorNetworks.find((o) => o.id === value);
    return item;
  }, [selectorNetworks, value]);

  useEffect(() => {
    if (selectorNetworks.length && !current) {
      const fallbackValue = selectorNetworks?.[0]?.id;
      if (fallbackValue) {
        onChange?.(fallbackValue);
      }
    }
  }, [selectorNetworks, current, onChange]);

  const sharedStyles = getSharedInputStyles({
    disabled,
    error,
    editable,
    size,
  });

  const openChainSelector = useConfigurableChainSelector();

  const onPress = useCallback(() => {
    if (disabled) {
      return;
    }
    openChainSelector({
      title,
      networkIds: selectorNetworks.map((o) => o.id),
      defaultNetworkId: current?.id,
      onSelect: (network) => onChange?.(network.id),
    });
  }, [
    disabled,
    openChainSelector,
    title,
    selectorNetworks,
    current?.id,
    onChange,
  ]);

  if (miniMode) {
    return (
      <Stack onPress={onPress} px="$3" py="$2.5" {...rest}>
        <NetworkAvatar networkId={current?.id} size="$6" />
      </Stack>
    );
  }

  return (
    <Stack
      userSelect="none"
      onPress={onPress}
      flexDirection="row"
      alignItems="center"
      borderRadius="$3"
      borderWidth={1}
      borderCurve="continuous"
      borderColor="$borderStrong"
      px="$3"
      py="$2.5"
      $gtMd={{
        borderRadius: '$2',
        py: '$2',
      }}
      testID="network-selector-input"
      {...(!disabled && {
        hoverStyle: {
          bg: '$bgHover',
        },
        pressStyle: {
          bg: '$bgActive',
        },
      })}
      {...rest}
    >
      <NetworkAvatar networkId={current?.id} size="$6" />
      <SizableText
        testID="network-selector-input-text"
        px={sharedStyles.px}
        flex={1}
        size={size === 'small' ? '$bodyMd' : '$bodyLg'}
      >
        {current?.name ?? ''}
      </SizableText>
      {!disabled ? (
        <Icon name="ChevronDownSmallOutline" mr="$-0.5" color="$iconSubdued" />
      ) : null}
    </Stack>
  );
};
