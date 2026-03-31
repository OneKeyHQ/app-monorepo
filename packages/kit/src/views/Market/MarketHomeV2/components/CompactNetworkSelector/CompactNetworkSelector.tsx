import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Image, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useMarketNetworks } from '../../../hooks/useMarketNetworks';
import { MoreButton } from '../MarketTokenListNetworkSelector/MoreButton';

const QUICK_CHAIN_COUNT = 4;

interface ICompactNetworkSelectorProps {
  selectedNetworkId?: string;
  onNetworkIdChange?: (id: string) => void;
}

function CompactNetworkSelector({
  selectedNetworkId,
  onNetworkIdChange,
}: ICompactNetworkSelectorProps) {
  const intl = useIntl();
  const { marketNetworks } = useMarketNetworks();

  const allNetwork = useMemo(
    () =>
      marketNetworks.find((n) =>
        networkUtils.isAllNetwork({ networkId: n.id }),
      ),
    [marketNetworks],
  );

  const quickChains = useMemo(() => {
    const base = marketNetworks
      .filter((n) => !networkUtils.isAllNetwork({ networkId: n.id }))
      .slice(0, QUICK_CHAIN_COUNT);
    // If selected network is not in base list, append it at the end
    if (
      selectedNetworkId &&
      !networkUtils.isAllNetwork({ networkId: selectedNetworkId }) &&
      !base.some((n) => n.id === selectedNetworkId)
    ) {
      const selected = marketNetworks.find((n) => n.id === selectedNetworkId);

      if (selected) {
        return [...base, selected];
      }
    }
    return base;
  }, [marketNetworks, selectedNetworkId]);

  const isAllSelected = useMemo(
    () =>
      !selectedNetworkId ||
      (allNetwork
        ? selectedNetworkId === allNetwork.id
        : networkUtils.isAllNetwork({ networkId: selectedNetworkId })),
    [selectedNetworkId, allNetwork],
  );

  const handleNetworkSelect = useCallback(
    (network: IServerNetwork) => {
      onNetworkIdChange?.(network.id);
    },
    [onNetworkIdChange],
  );

  const handleAllPress = useCallback(() => {
    if (allNetwork) {
      onNetworkIdChange?.(allNetwork.id);
    }
  }, [allNetwork, onNetworkIdChange]);

  const moreButtonTrigger = useCallback(
    (isOpen: boolean, onPress: () => void): ReactNode => (
      <Stack
        p="$1"
        borderRadius="$full"
        hoverStyle={{ bg: '$bgStrongHover' }}
        pressStyle={{ bg: '$bgStrongActive' }}
        onPress={onPress}
        cursor="pointer"
        userSelect="none"
      >
        <Icon
          name={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
          size="$4"
          color="$iconSubdued"
        />
      </Stack>
    ),
    [],
  );

  return (
    <XStack
      bg="$bgStrong"
      borderRadius="$full"
      p="$0.5"
      gap="$1"
      alignItems="center"
    >
      <Stack
        px="$2"
        py="$1"
        borderRadius="$full"
        bg={isAllSelected ? '$bgActive' : '$transparent'}
        focusable
        hoverStyle={!isAllSelected ? { bg: '$bgStrongHover' } : undefined}
        pressStyle={!isAllSelected ? { bg: '$bgStrongActive' } : undefined}
        onPress={handleAllPress}
        cursor="pointer"
        userSelect="none"
      >
        <SizableText
          size="$bodySm"
          color={isAllSelected ? '$text' : '$textSubdued'}
        >
          {intl.formatMessage({ id: ETranslations.global_all })}
        </SizableText>
      </Stack>

      {quickChains.map((network) => {
        const isSelected = !isAllSelected && selectedNetworkId === network.id;
        return (
          <Stack
            key={network.id}
            p="$1"
            borderRadius="$full"
            bg={isSelected ? '$neutral6' : '$transparent'}
            focusable
            hoverStyle={!isSelected ? { bg: '$bgStrongHover' } : undefined}
            pressStyle={!isSelected ? { bg: '$bgStrongActive' } : undefined}
            onPress={() => onNetworkIdChange?.(network.id)}
            cursor="pointer"
            userSelect="none"
          >
            <Image
              width={17}
              height={17}
              borderRadius="$full"
              source={{ uri: network.logoURI }}
            />
          </Stack>
        );
      })}

      <MoreButton
        networks={marketNetworks}
        selectedNetworkId={selectedNetworkId}
        onNetworkSelect={handleNetworkSelect}
        customTrigger={moreButtonTrigger}
        placement="bottom-end"
      />
    </XStack>
  );
}

export { CompactNetworkSelector };
export type { ICompactNetworkSelectorProps };
