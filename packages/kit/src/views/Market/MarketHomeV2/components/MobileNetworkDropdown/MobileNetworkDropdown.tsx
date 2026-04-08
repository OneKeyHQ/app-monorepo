import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  Popover,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useMarketNetworks } from '../../../hooks/useMarketNetworks';

interface IMobileNetworkDropdownProps {
  selectedNetworkId?: string;
  onNetworkIdChange?: (id: string) => void;
}

function NetworkDropdownContent({
  networks,
  selectedNetworkId,
  onSelect,
  closePopover,
}: {
  networks: IServerNetwork[];
  selectedNetworkId?: string;
  onSelect: (network: IServerNetwork) => void;
  closePopover: () => void;
}) {
  const intl = useIntl();

  return (
    <Stack pt="$4">
      {networks.map((item) => {
        const { isAllNetworks } = item;
        return (
          <ListItem
            key={item.id}
            h={48}
            renderAvatar={
              <NetworkAvatarBase
                logoURI={item.logoURI}
                isCustomNetwork={item.isCustomNetwork}
                networkName={item.name}
                isAllNetworks={isAllNetworks}
                allNetworksIconProps={{
                  color: '$iconActive',
                }}
                size="$8"
              />
            }
            title={
              isAllNetworks
                ? intl.formatMessage({
                    id: ETranslations.global_all_networks,
                  })
                : item.name
            }
            onPress={() => {
              onSelect(item);
              closePopover();
            }}
          >
            {selectedNetworkId === item.id ? (
              <ListItem.CheckMark key="checkmark" />
            ) : null}
          </ListItem>
        );
      })}
    </Stack>
  );
}

function MobileNetworkDropdownImpl({
  selectedNetworkId,
  onNetworkIdChange,
}: IMobileNetworkDropdownProps) {
  const intl = useIntl();
  const { marketNetworks } = useMarketNetworks();

  const selectedNetwork = useMemo(
    () => marketNetworks.find((n) => n.id === selectedNetworkId),
    [marketNetworks, selectedNetworkId],
  );

  const isAllNetworks =
    !selectedNetworkId ||
    networkUtils.isAllNetwork({ networkId: selectedNetworkId });

  const displayName = isAllNetworks
    ? intl.formatMessage({ id: ETranslations.global_all })
    : (selectedNetwork?.name ?? '');

  const handleNetworkSelect = useCallback(
    (network: IServerNetwork) => {
      onNetworkIdChange?.(network.id);
    },
    [onNetworkIdChange],
  );

  const renderTrigger = useMemo(
    () => (
      <XStack gap="$1" alignItems="center" cursor="pointer" userSelect="none">
        {isAllNetworks || !selectedNetwork?.logoURI ? (
          <Icon name="AllNetworksSolid" size="$4.5" color="$iconStrong" />
        ) : (
          <Image
            width={18}
            height={18}
            borderRadius="$full"
            source={{ uri: selectedNetwork.logoURI }}
          />
        )}
        <SizableText size="$bodyMdMedium">{displayName}</SizableText>
        <Icon name="ChevronDownSmallOutline" size="$4.5" color="$iconSubdued" />
      </XStack>
    ),
    [displayName, isAllNetworks, selectedNetwork],
  );

  const RenderContent = useCallback(
    ({ closePopover }: { isOpen?: boolean; closePopover: () => void }) => (
      <NetworkDropdownContent
        networks={marketNetworks}
        selectedNetworkId={selectedNetworkId}
        onSelect={handleNetworkSelect}
        closePopover={closePopover}
      />
    ),
    [marketNetworks, selectedNetworkId, handleNetworkSelect],
  );

  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.global_select_network })}
      placement="bottom-start"
      floatingPanelProps={{
        maxWidth: 384,
      }}
      sheetProps={{
        snapPoints: [60],
        snapPointsMode: 'percent',
      }}
      renderTrigger={renderTrigger}
      renderContent={RenderContent}
    />
  );
}

export const MobileNetworkDropdown = memo(MobileNetworkDropdownImpl);
