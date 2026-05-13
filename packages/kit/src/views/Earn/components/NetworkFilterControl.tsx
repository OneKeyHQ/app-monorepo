import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Checkbox,
  Icon,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EarnTestIDs } from '@onekeyhq/kit/src/views/Earn/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface INetworkFilterControlProps {
  availableNetworkIds: string[];
  selectedNetworkIds: string[];
  networkAssetCounts: Record<string, number>;
  onSelectionChange: (networkIds: string[]) => void;
}

function NetworkFilterControl({
  availableNetworkIds,
  selectedNetworkIds,
  networkAssetCounts,
  onSelectionChange,
}: INetworkFilterControlProps) {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);

  const { result: networks } = usePromiseResult(async () => {
    if (availableNetworkIds.length === 0) return [];
    const resp = await backgroundApiProxy.serviceNetwork.getNetworksByIds({
      networkIds: availableNetworkIds,
    });
    return resp.networks;
  }, [availableNetworkIds]);

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

  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.global_networks })}
      showHeader={false}
      open={isOpen}
      onOpenChange={setIsOpen}
      renderTrigger={
        <XStack ai="center" gap="$2" cursor="pointer">
          <SizableText
            size={hasActiveFilter ? '$bodyMdMedium' : '$bodyMd'}
            color={hasActiveFilter ? '$text' : '$textSubdued'}
          >
            {buttonLabel}
          </SizableText>
          <Icon
            name={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
            size="$4.5"
            color="$iconSubdued"
          />
        </XStack>
      }
      floatingPanelProps={{
        maxWidth: 240,
      }}
      renderContent={
        <YStack px="$5" py="$4">
          <XStack jc="space-between" ai="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_networks })}
            </SizableText>
            {selectedNetworkIds.length > 0 ? (
              <Button
                testID={EarnTestIDs.networkFilterResetButton}
                variant="tertiary"
                size="small"
                onPress={handleReset}
              >
                {intl.formatMessage({ id: ETranslations.global_reset })}
              </Button>
            ) : null}
          </XStack>
          <YStack mt="$2.5">
            {sortedNetworks?.map((network) => {
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
      }
      placement="bottom-start"
    />
  );
}

export { NetworkFilterControl };
