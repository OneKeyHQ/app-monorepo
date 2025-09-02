import { useCallback, useEffect, useMemo } from 'react';

import {
  Icon,
  NATIVE_HIT_SLOP,
  SizableText,
  XStack,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import useConfigurableChainSelector from '../../../views/ChainSelector/hooks/useChainSelector';
import { NetworkAvatar } from '../../NetworkAvatar';

function NetworkSelectorTriggerApproval({
  networkIds,
  value,
  onChange,
  title,
  disabled,
}: {
  networkIds: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  title?: string;
}) {
  const { result: selectorNetworks } = usePromiseResult(
    async () => {
      if (networkIds) {
        const { networks } =
          await backgroundApiProxy.serviceNetwork.getNetworksByIds({
            networkIds,
          });
        return networks;
      }

      const { networks } =
        await backgroundApiProxy.serviceNetwork.getAllNetworks();
      return networks;
    },
    [networkIds],
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
      excludeAllNetworkItem: false,
      grouped: false,
    });
  }, [
    disabled,
    openChainSelector,
    title,
    selectorNetworks,
    current?.id,
    onChange,
  ]);

  return (
    <XStack
      role="button"
      flexShrink={1}
      alignItems="center"
      p="$1"
      ml="$-1"
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable
      focusVisibleStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      hitSlop={NATIVE_HIT_SLOP}
      userSelect="none"
      onPress={onPress}
    >
      <NetworkAvatar networkId={current?.id} size="$5" />
      <SizableText
        pl="$2"
        size="$bodyMd"
        maxWidth="$28"
        $gtXl={{
          maxWidth: '$32',
        }}
        flexShrink={1}
        numberOfLines={1}
      >
        {current?.name ?? ''}
      </SizableText>
      <Icon
        name="ChevronDownSmallOutline"
        color="$iconSubdued"
        size="$5"
        flexShrink={0}
      />
    </XStack>
  );
}

export { NetworkSelectorTriggerApproval };
