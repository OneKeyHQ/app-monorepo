import { useIntl } from 'react-intl';

import {
  Button,
  ScrollView,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { NetworksFilterItem } from '@onekeyhq/kit/src/components/NetworksFilterItem';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useDustSweep } from '../DustSweepProvider';

export function DustSweepNetworks({ desktop = false }: { desktop?: boolean }) {
  const { networks, current, selecting, selectNetwork, loadStatus } =
    useDustSweep();
  const intl = useIntl();
  const openChainSelector = useConfigurableChainSelector();
  const title = intl.formatMessage({ id: ETranslations.global_select_network });
  const networkSelectionDisabled = !selecting || !networks.length;
  if (desktop)
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        flexGrow={0}
        height={32}
        minHeight={32}
      >
        <XStack
          height={32}
          alignItems="center"
          gap="$2"
          opacity={selecting ? 1 : 0.4}
        >
          {loadStatus === 'loading' && !networks.length
            ? [0, 1, 2, 3].map((key) => (
                <Skeleton key={key} width={136} height={32} radius="round" />
              ))
            : null}
          {networks.map((entry) => (
            <Button
              mx={0}
              my={0}
              key={entry.network.networkId}
              testID={`dust-sweep-network-${entry.network.networkId}`}
              size="small"
              height={32}
              borderRadius="$full"
              variant={entry === current ? 'secondary' : 'tertiary'}
              borderWidth={1}
              borderColor="$borderSubdued"
              disabled={!selecting}
              onPress={() => selectNetwork(entry.network.networkId)}
            >
              <XStack gap="$1" alignItems="center">
                <NetworkAvatar networkId={entry.network.networkId} size="$4" />
                <SizableText size="$bodyMd">{entry.network.name}</SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  ${Number(entry.valueUsd).toFixed(2)}
                </SizableText>
              </XStack>
            </Button>
          ))}
        </XStack>
      </ScrollView>
    );
  return (
    <NetworksFilterItem
      testID="dust-sweep-network-menu"
      role="button"
      accessibilityLabel={current?.network.name ?? title}
      accessibilityState={{ disabled: networkSelectionDisabled }}
      networkImageUri={current?.network.logoURI}
      networkImageSize="$4"
      keepNetworkImageSize
      networkName={current?.network.shortcode ?? title}
      networkNameProps={{ size: '$bodyMd', color: '$text', flexShrink: 1 }}
      iconAfter="ChevronDownSmallOutline"
      width={108}
      height={30}
      py={0}
      gap="$1"
      alignItems="center"
      borderRadius="$full"
      borderColor="$transparent"
      bg="$bgStrong"
      disabled={networkSelectionDisabled}
      focusable={!networkSelectionDisabled}
      onPress={
        networkSelectionDisabled
          ? undefined
          : () =>
              openChainSelector({
                title,
                defaultNetworkId: current?.network.networkId,
                networkIds: networks.map((entry) => entry.network.networkId),
                grouped: false,
                excludeAllNetworkItem: true,
                onSelect: (network) => selectNetwork(network.id),
              })
      }
    />
  );
}

export function DustSweepFilters({ desktop }: { desktop: boolean }) {
  const { selecting, threshold, selectThreshold } = useDustSweep();
  return (
    <XStack
      height={56}
      px="$5"
      alignItems="center"
      justifyContent="space-between"
      opacity={selecting ? 1 : 0.4}
    >
      <XStack gap="$1">
        {([1, 10, 100] as const).map((amount) => (
          <Button
            mx={0}
            my={0}
            testID={`dust-sweep-threshold-${amount}`}
            key={amount}
            size="small"
            height={30}
            px="$3"
            borderRadius="$full"
            disabled={!selecting}
            variant={threshold === amount ? 'secondary' : 'tertiary'}
            onPress={() => selectThreshold(amount)}
          >{`<$${amount}`}</Button>
        ))}
      </XStack>
      {desktop ? null : <DustSweepNetworks />}
    </XStack>
  );
}
