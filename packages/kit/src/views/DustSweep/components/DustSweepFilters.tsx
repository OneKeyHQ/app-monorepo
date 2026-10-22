import { useIntl } from 'react-intl';

import { Button, Skeleton, Stack, XStack } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import {
  NetworkAvatar,
  NetworkAvatarBase,
} from '@onekeyhq/kit/src/components/NetworkAvatar';
import { NetworksFilterItem } from '@onekeyhq/kit/src/components/NetworksFilterItem';
import {
  ScrollableFilterBar,
  useScrollableFilterBar,
} from '@onekeyhq/kit/src/components/ScrollableFilterBar';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import { CategoryFilterItem } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/CategoryFilterItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDustSweepNetwork } from '@onekeyhq/shared/types/swap/dustSweep';

import { useDustSweep } from '../DustSweepProvider';
import { DUST_SWEEP_THRESHOLDS } from '../utils/candidates';

function DustSweepNetworkChip({
  entry,
  selected,
  canSelect,
  onSelect,
}: {
  entry: IDustSweepNetwork;
  selected: boolean;
  canSelect: boolean;
  onSelect: (networkId: string) => void;
}) {
  const { handleItemLayout } = useScrollableFilterBar();
  const networkId = entry.network.networkId;
  return (
    <Stack
      testID={`dust-sweep-chip-layout-${networkId}`}
      height={36}
      flexShrink={0}
      onLayout={(event) => handleItemLayout(networkId, event)}
    >
      <Button
        mx={0}
        my={0}
        testID={`dust-sweep-network-${networkId}`}
        size="small"
        height={36}
        px="$2"
        borderRadius="$full"
        variant={selected ? 'secondary' : 'tertiary'}
        borderWidth={1}
        borderColor="$borderSubdued"
        accessibilityLabel={entry.network.name}
        accessibilityState={{ disabled: !canSelect }}
        focusable={canSelect}
        onPress={canSelect ? () => onSelect(networkId) : undefined}
      >
        <XStack gap="$1.5" alignItems="center">
          {/* The execution route remounts these chips; keep their loaded
            logos instead of waiting for another network lookup. */}
          {entry.network.logoURI ? (
            <NetworkAvatarBase logoURI={entry.network.logoURI} size="$6" />
          ) : (
            <NetworkAvatar networkId={networkId} size="$6" />
          )}
          <Currency size="$bodyMdMedium" sourceCurrency="usd" formatter="value">
            {entry.balanceUsd}
          </Currency>
        </XStack>
      </Button>
    </Stack>
  );
}

export function DustSweepNetworks({ desktop = false }: { desktop?: boolean }) {
  const { networks, current, canSelectNetwork, selectNetwork, loadStatus } =
    useDustSweep();
  const intl = useIntl();
  const openChainSelector = useConfigurableChainSelector();
  const title = intl.formatMessage({ id: ETranslations.global_select_network });
  const networkSelectionDisabled = !canSelectNetwork || !networks.length;
  if (desktop)
    return (
      <Stack
        testID="dust-sweep-network-scroll"
        flexGrow={0}
        height={36}
        minHeight={36}
        // While sweeping the chips keep their look but can't be changed.
        cursor={canSelectNetwork ? undefined : 'not-allowed'}
      >
        <ScrollableFilterBar
          selectedItemId={current?.network.networkId}
          contentContainerStyle={{ height: 36 }}
        >
          <XStack
            height={36}
            alignItems="center"
            gap="$2"
            pointerEvents={canSelectNetwork ? 'auto' : 'none'}
          >
            {loadStatus === 'loading' && !networks.length
              ? [0, 1, 2, 3].map((key) => (
                  <Skeleton key={key} width={96} height={36} radius="round" />
                ))
              : null}
            {networks.map((entry) => (
              <DustSweepNetworkChip
                key={entry.network.networkId}
                entry={entry}
                selected={entry === current}
                canSelect={canSelectNetwork}
                onSelect={selectNetwork}
              />
            ))}
          </XStack>
        </ScrollableFilterBar>
      </Stack>
    );
  return (
    <NetworksFilterItem
      testID="dust-sweep-network-menu"
      role="button"
      accessibilityLabel={current?.network.name ?? title}
      accessibilityState={{ disabled: networkSelectionDisabled }}
      networkImageUri={current?.network.logoURI}
      networkImageSize="$6"
      keepNetworkImageSize
      // Icon only once a network is selected; the name stays in the a11y label.
      networkName={current ? undefined : title}
      networkNameProps={{ size: '$bodyMd', color: '$text', flexShrink: 1 }}
      iconAfter="ChevronDownSmallOutline"
      height={36}
      px="$2"
      py={0}
      gap="$1"
      alignItems="center"
      borderRadius="$full"
      borderColor="$transparent"
      bg="$bgStrong"
      disabled={!networks.length}
      focusable={!networkSelectionDisabled}
      cursor={networkSelectionDisabled ? 'not-allowed' : 'pointer'}
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
    >
      <XStack
        gap="$1"
        cursor={selecting ? undefined : 'not-allowed'}
        pointerEvents={selecting ? 'auto' : 'none'}
      >
        {DUST_SWEEP_THRESHOLDS.map((amount) => (
          <CategoryFilterItem
            testID={`dust-sweep-threshold-${amount}`}
            key={amount}
            name={`<$${amount}`}
            isSelected={threshold === amount}
            height={36}
            px="$3"
            borderRadius="$full"
            role="button"
            {...(platformEnv.isNative
              ? { accessibilityState: { selected: threshold === amount } }
              : { 'aria-pressed': threshold === amount })}
            aria-disabled={!selecting}
            focusable={selecting}
            onPress={() => selectThreshold(amount)}
          />
        ))}
      </XStack>
      {desktop ? null : <DustSweepNetworks />}
    </XStack>
  );
}
