import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Checkbox,
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EarnTestIDs } from '@onekeyhq/kit/src/views/Earn/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

interface INetworkFilterControlProps {
  availableNetworkIds: string[];
  selectedNetworkIds: string[];
  networkAssetCounts: Record<string, number>;
  onSelectionChange: (networkIds: string[]) => void;
  testID?: string;
  variant?: 'default' | 'compact';
  keepSheetLayout?: boolean;
}

type INetworkFilterContent = Pick<
  INetworkFilterControlProps,
  'selectedNetworkIds' | 'networkAssetCounts' | 'keepSheetLayout'
> & {
  networks: IServerNetwork[] | undefined;
  toggleNetwork: (networkId: string) => void;
  handleReset: () => void;
};

const NetworkFilterContentContext = createContext<INetworkFilterContent | null>(
  null,
);

function NetworkFilterContent() {
  const intl = useIntl();
  const content = useContext(NetworkFilterContentContext);
  if (!content) return null;

  const {
    selectedNetworkIds,
    networkAssetCounts,
    keepSheetLayout,
    networks,
    toggleNetwork,
    handleReset,
  } = content;
  const hasActiveFilter = selectedNetworkIds.length > 0;
  const isAllNetworksSelected = !hasActiveFilter;

  return (
    <YStack px="$5" py="$4">
      <XStack jc="space-between" ai="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_networks })}
        </SizableText>
        {hasActiveFilter || keepSheetLayout ? (
          <Stack
            opacity={hasActiveFilter ? 1 : 0}
            accessibilityElementsHidden={!hasActiveFilter}
            importantForAccessibility={
              hasActiveFilter ? 'auto' : 'no-hide-descendants'
            }
          >
            <Button
              disabled={!hasActiveFilter}
              testID={EarnTestIDs.networkFilterResetButton}
              variant="tertiary"
              size="small"
              onPress={handleReset}
            >
              {intl.formatMessage({ id: ETranslations.global_reset })}
            </Button>
          </Stack>
        ) : null}
      </XStack>
      <YStack mt="$2.5">
        <XStack
          py="$2"
          gap="$2"
          ai="center"
          onPress={handleReset}
          cursor="pointer"
        >
          <Checkbox
            testID={EarnTestIDs.networkFilterAllCheckbox}
            value={isAllNetworksSelected}
            onChange={handleReset}
            containerProps={{ py: '$0', flexShrink: 0 }}
            shouldStopPropagation
          />
          {/* Same all-networks glyph as the trigger above (OK-59960) */}
          <Icon name="AllNetworksSolid" size="$5" color="$iconActive" />
          <SizableText size="$bodyLgMedium" flex={1}>
            {intl.formatMessage({
              id: ETranslations.global_all_networks,
            })}
          </SizableText>
        </XStack>
        {networks?.map((network) => {
          const isSelected = selectedNetworkIds.includes(network.id);
          const count = networkAssetCounts[network.id] ?? 0;
          return (
            <XStack
              key={network.id}
              py="$2"
              gap="$2"
              ai="center"
              onPress={() => toggleNetwork(network.id)}
              cursor="pointer"
            >
              <Checkbox
                testID={EarnTestIDs.networkFilterCheckbox(network.id)}
                value={isSelected}
                onChange={() => toggleNetwork(network.id)}
                containerProps={{ py: '$0', flexShrink: 0 }}
                shouldStopPropagation
              />
              <NetworkAvatar networkId={network.id} size="$5" />
              <SizableText size="$bodyLgMedium" flex={1}>
                {network.name}
              </SizableText>
              {count > 0 ? (
                <Badge
                  badgeType="default"
                  badgeSize="sm"
                  minWidth={20}
                  borderRadius="$full"
                  justifyContent="center"
                  px="$1.5"
                >
                  {String(count)}
                </Badge>
              ) : null}
            </XStack>
          );
        })}
      </YStack>
    </YStack>
  );
}

// Selection changes update the content through context without invalidating the
// native fit sheet's measurement for every checkbox render.
const NETWORK_FILTER_CONTENT = <NetworkFilterContent />;

function NetworkFilterControl({
  availableNetworkIds,
  selectedNetworkIds,
  networkAssetCounts,
  onSelectionChange,
  testID,
  variant = 'default',
  keepSheetLayout,
}: INetworkFilterControlProps) {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);

  // A selected network the list no longer offers (the page's data changed
  // under it) is still resolved, so the trigger names it instead of falling
  // back to "All networks" beside its icon, and the list lets it be cleared
  // (OK-64596).
  const extraNetworkIdsKey = selectedNetworkIds
    .filter((id) => !availableNetworkIds.includes(id))
    .join(',');
  const { result: networks } = usePromiseResult(async () => {
    const networkIdsToResolve = extraNetworkIdsKey
      ? [...availableNetworkIds, ...extraNetworkIdsKey.split(',')]
      : availableNetworkIds;
    if (networkIdsToResolve.length === 0) return [];
    const resp = await backgroundApiProxy.serviceNetwork.getNetworksByIds({
      networkIds: networkIdsToResolve,
    });
    return resp.networks;
  }, [availableNetworkIds, extraNetworkIdsKey]);

  const sortedNetworks = useMemo(
    () =>
      networks
        ?.slice()
        .sort(
          (a, b) =>
            (networkAssetCounts[b.id] ?? 0) - (networkAssetCounts[a.id] ?? 0),
        ),
    [networks, networkAssetCounts],
  );

  const toggleNetwork = useCallback(
    (networkId: string) => {
      const isSelected = selectedNetworkIds.includes(networkId);
      if (isSelected) {
        onSelectionChange(selectedNetworkIds.filter((id) => id !== networkId));
      } else {
        onSelectionChange([...selectedNetworkIds, networkId]);
      }
    },
    [selectedNetworkIds, onSelectionChange],
  );

  const handleReset = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  const hasActiveFilter = selectedNetworkIds.length > 0;
  const isCompact = variant === 'compact';
  const singleSelectedNetworkId =
    selectedNetworkIds.length === 1 ? selectedNetworkIds[0] : undefined;
  let compactLeadingIcon;
  if (isCompact) {
    if (singleSelectedNetworkId) {
      compactLeadingIcon = (
        <NetworkAvatar networkId={singleSelectedNetworkId} size="$4" />
      );
    } else {
      // OK-59960: the app-wide all-networks glyph is AllNetworksSolid (same as
      // NetworkAvatarBase / NetworksFilterItem). The generic globe icon is the
      // fallback drawn when a network logo fails to load, so using it here read
      // as a different, inconsistent icon.
      compactLeadingIcon = (
        <Icon name="AllNetworksSolid" size="$4" color="$iconActive" />
      );
    }
  }
  let buttonTextSize: '$bodySmMedium' | '$bodyMdMedium' | '$bodyMd' = '$bodyMd';
  let buttonTextColor: '$textSubdued' | '$text' = '$textSubdued';
  if (isCompact) {
    buttonTextSize = '$bodySmMedium';
  } else if (hasActiveFilter) {
    buttonTextSize = '$bodyMdMedium';
    buttonTextColor = '$text';
  }

  const buttonLabel = useMemo(() => {
    if (selectedNetworkIds.length === 0) {
      return intl.formatMessage({ id: ETranslations.global_all_networks });
    }
    if (selectedNetworkIds.length === 1) {
      const network = networks?.find((n) => n.id === selectedNetworkIds[0]);
      return (
        network?.name ??
        intl.formatMessage({ id: ETranslations.global_all_networks })
      );
    }
    return intl.formatMessage(
      { id: ETranslations.global_count_networks },
      { count: selectedNetworkIds.length },
    );
  }, [selectedNetworkIds, networks, intl]);

  const content = useMemo(
    () => ({
      selectedNetworkIds,
      networkAssetCounts,
      keepSheetLayout,
      networks: sortedNetworks,
      toggleNetwork,
      handleReset,
    }),
    [
      selectedNetworkIds,
      networkAssetCounts,
      keepSheetLayout,
      sortedNetworks,
      toggleNetwork,
      handleReset,
    ],
  );

  return (
    <NetworkFilterContentContext.Provider value={content}>
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_networks })}
        showHeader={false}
        open={isOpen}
        onOpenChange={setIsOpen}
        renderTrigger={
          <XStack
            testID={testID}
            ai="center"
            gap={isCompact ? '$1' : '$2'}
            hitSlop={isCompact ? 8 : undefined}
            cursor="pointer"
            userSelect="none"
          >
            {compactLeadingIcon}
            <SizableText
              size={buttonTextSize}
              color={buttonTextColor}
              numberOfLines={1}
            >
              {buttonLabel}
            </SizableText>
            <Icon
              name={
                isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
              }
              size={isCompact ? '$4' : '$4.5'}
              color="$iconSubdued"
            />
          </XStack>
        }
        floatingPanelProps={{
          maxWidth: 240,
        }}
        renderContent={NETWORK_FILTER_CONTENT}
        placement="bottom-start"
      />
    </NetworkFilterContentContext.Provider>
  );
}

export { NetworkFilterControl };
