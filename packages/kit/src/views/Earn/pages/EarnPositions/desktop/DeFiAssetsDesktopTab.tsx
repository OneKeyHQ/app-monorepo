import { memo, useCallback } from 'react';

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
import { useCardFocus, useFocusRequestOnce } from '../useCardFocus';

import { EarnPortfolioOverview } from './EarnPortfolioOverview';
import { EarnPositionDesktopBlock } from './EarnPositionDesktopBlock';

import type { IEarnPositionCardHandlers } from '../mobile/EarnPositionCard';
import type { IEarnProtocolView } from '../mobile/earnPositionModel';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

/**
 * DeFi Assets in the wide layout, the way the wallet DeFi Portfolio reads on
 * desktop: the allocation overview, then one open card per protocol per
 * network, its holdings as tables. A tile opens its card and scrolls the
 * page to it. The phone tab's empty and loading states.
 */
function BasicDeFiAssetsDesktopTab({
  focusRequest,
  focusCardRequest,
  protocols,
  deFiProtocols,
  protocolMap,
  isLoading,
  pendingCountByProvider,
  onManage,
  onRedeem,
  onWarmRedeem,
}: {
  /** A share of the home's split: its protocols' cards, once they are in */
  focusRequest?: { protocols: string[]; at: number };
  /** A Your loans card: its market's one card, once it is in */
  focusCardRequest?: { cardKeys: string[]; at: number };
  protocols: IEarnProtocolView[];
  deFiProtocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
  isLoading: boolean;
  pendingCountByProvider: Record<string, number>;
} & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const expansion = useGroupExpansion();
  const networkNames = useRepeatedProtocolNetworkNames(protocols);
  // The cards a tile or a request scrolls to, as the wallet's tiles do
  const { flashKeys, registerAnchor, scrollToCards } = useCardFocus({
    isOpen: expansion.isExpanded,
    open: expansion.open,
  });
  const positionsLabel = intl.formatMessage({
    id: ETranslations.earn_positions,
  });
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  const handlePressProtocol = useCallback(
    (protocol: IDeFiProtocol) => {
      scrollToCards([
        defiUtils.buildProtocolMapKey({
          protocol: protocol.protocol,
          networkId: protocol.networkId,
        }),
      ]);
    },
    [scrollToCards],
  );
  // A share of the split is a protocol across networks, "N more" several:
  // all their cards, the page scrolled to the first of them
  const handleOpenSplitProtocols = useCallback(
    (protocolKeys: string[]) =>
      scrollToCards(
        protocols
          .filter((protocol) =>
            protocolKeys.includes(protocol.protocol.toLowerCase()),
          )
          .map((protocol) => protocol.key),
      ),
    [protocols, scrollToCards],
  );
  // The home's split asked for a protocol: done once its cards are in, or
  // dropped if they don't come
  useFocusRequestOnce(
    focusRequest,
    useCallback(
      (request: { protocols: string[] }) =>
        handleOpenSplitProtocols(request.protocols),
      [handleOpenSplitProtocols],
    ),
  );
  // A Your loans card asked for its market's card, the same way
  useFocusRequestOnce(
    focusCardRequest,
    useCallback(
      (request: { cardKeys: string[] }) => scrollToCards(request.cardKeys),
      [scrollToCards],
    ),
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
        networkNames={networkNames}
        onPressProtocol={handlePressProtocol}
        onOpenSplitProtocols={handleOpenSplitProtocols}
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
              isHighlighted={flashKeys.has(protocol.key)}
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
                  onWarmRedeem={onWarmRedeem}
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
