import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  Popover,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useMarketNetworks } from '../../../hooks/useMarketNetworks';
import {
  NETWORKS_SEARCH_PANEL_MAX_HEIGHT,
  NetworksSearchPanel,
} from '../MarketTokenListNetworkSelector/NetworksSearchPanel';

interface IMobileNetworkDropdownProps {
  selectedNetworkId?: string;
  onNetworkIdChange?: (id: string) => void;
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
    ({
      isOpen,
      closePopover,
    }: {
      isOpen?: boolean;
      closePopover: () => void;
    }) => (
      <NetworksSearchPanel
        isOpen={isOpen}
        networks={marketNetworks}
        networkId={selectedNetworkId}
        onNetworkSelect={(network) => {
          handleNetworkSelect(network);
          closePopover();
        }}
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
        maxHeight: NETWORKS_SEARCH_PANEL_MAX_HEIGHT,
      }}
      sheetProps={{
        dismissOnSnapToBottom: false,
        disableDrag: true,
      }}
      renderTrigger={renderTrigger}
      renderContent={RenderContent}
    />
  );
}

export const MobileNetworkDropdown = memo(MobileNetworkDropdownImpl);
