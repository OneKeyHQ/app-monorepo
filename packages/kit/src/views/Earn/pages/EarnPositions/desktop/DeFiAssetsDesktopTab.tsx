import { memo, useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Spinner, Stack, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { EarnTestIDs } from '../../../testIDs';
import { GroupRow, useGroupExpansion } from '../mobile/GroupRow';
import { useRepeatedProtocolNetworkNames } from '../mobile/useRepeatedProtocolNetworkNames';

import { EarnPortfolioOverview } from './EarnPortfolioOverview';
import { EarnPositionDesktopBlock } from './EarnPositionDesktopBlock';

import type { IEarnPositionCardHandlers } from '../mobile/EarnPositionCard';
import type { IEarnProtocolView } from '../mobile/earnPositionModel';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];
// The gap between the cards ($4)
const CARD_SCROLL_MARGIN_TOP = 16;

/**
 * DeFi Assets in the wide layout, the way the wallet DeFi Portfolio reads on
 * desktop: the allocation overview, then one open card per protocol per
 * network, its holdings as tables. A tile opens its card and scrolls the
 * page to it. The phone tab's empty and loading states.
 */
function BasicDeFiAssetsDesktopTab({
  protocols,
  deFiProtocols,
  protocolMap,
  isLoading,
  pendingCountByProvider,
  onManage,
  onRedeem,
}: {
  protocols: IEarnProtocolView[];
  deFiProtocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
  isLoading: boolean;
  pendingCountByProvider: Record<string, number>;
} & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const expansion = useGroupExpansion();
  const { open } = expansion;
  const networkNames = useRepeatedProtocolNetworkNames(protocols);
  const anchorsRef = useRef(new Map<string, HTMLElement>());
  const positionsLabel = intl.formatMessage({
    id: ETranslations.earn_positions,
  });
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });

  const registerAnchor = useCallback(
    (key: string, node: HTMLElement | null) => {
      if (node) {
        anchorsRef.current.set(key, node);
      } else {
        anchorsRef.current.delete(key);
      }
    },
    [],
  );
  const handlePressProtocol = useCallback(
    (protocol: IDeFiProtocol) => {
      const key = defiUtils.buildProtocolMapKey({
        protocol: protocol.protocol,
        networkId: protocol.networkId,
      });
      open(key);
      // Web and desktop scroll the page to the card, as the wallet's tiles
      // do, and leave the cards' gap above it
      const node = anchorsRef.current.get(key);
      if (node && typeof node.scrollIntoView === 'function') {
        node.style.scrollMarginTop = `${CARD_SCROLL_MARGIN_TOP}px`;
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [open],
  );

  let placeholder: React.ReactNode = null;
  if (protocols.length === 0) {
    placeholder = isLoading ? (
      <Stack ai="center" py="$8">
        <Spinner size="large" />
      </Stack>
    ) : (
      <Empty
        illustration="BlockPercentage"
        title={intl.formatMessage({
          id: ETranslations.earn_no_assets_deposited,
        })}
      />
    );
  }

  return (
    <YStack gap="$8" pb="$4">
      <EarnPortfolioOverview
        protocols={protocols}
        deFiProtocols={deFiProtocols}
        protocolMap={protocolMap}
        onPressProtocol={handlePressProtocol}
      />
      {placeholder}
      {protocols.length > 0 ? (
        <YStack gap="$4">
          {protocols.map((protocol) => (
            <GroupRow
              key={protocol.key}
              name={protocol.name}
              logoURI={protocol.logoURI}
              networkId={protocol.networkId}
              networkName={networkNames.get(protocol.key)}
              subtitle={`${protocol.positions.length} ${positionsLabel}`}
              pendingCount={pendingCountByProvider[protocol.protocol] ?? 0}
              expanded={expansion.isExpanded(protocol.key)}
              onToggle={() => expansion.toggle(protocol.key)}
              anchorRef={(node) => registerAnchor(protocol.key, node)}
              testID={EarnTestIDs.portfolioItem(protocol.name)}
              total={
                <ProtocolValueCell
                  value={protocol.value.value}
                  currencySymbol={currencyInfo.symbol}
                  priceUnavailableLabel={priceUnavailableLabel}
                  isUnavailable={!protocol.value.hasAvailableValue}
                  size="$headingLg"
                  textAlign="right"
                  numberOfLines={1}
                  fontVariant={TABULAR_NUMS}
                />
              }
            >
              {protocol.positions.map((position) => (
                <EarnPositionDesktopBlock
                  key={position.key}
                  position={position}
                  onManage={onManage}
                  onRedeem={onRedeem}
                />
              ))}
            </GroupRow>
          ))}
        </YStack>
      ) : null}
      {/* scopes still landing behind the cards already shown */}
      {isLoading && protocols.length > 0 ? (
        <Stack ai="center" py="$4">
          <Spinner size="small" />
        </Stack>
      ) : null}
    </YStack>
  );
}

// Kept mounted while hidden on web; re-renders only when its own data changes
export const DeFiAssetsDesktopTab = memo(BasicDeFiAssetsDesktopTab);
