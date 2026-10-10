import { useIntl } from 'react-intl';

import { YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EarnTestIDs } from '../../../testIDs';

import { EarnPositionCard } from './EarnPositionCard';
import { GroupRow } from './GroupRow';

import type { IEarnPositionCardHandlers } from './EarnPositionCard';
import type { IEarnProtocolView } from './earnPositionModel';
import type { IGroupExpansion } from './GroupRow';

/**
 * Protocol rows (one per protocol per network, the network on the logo
 * badge) and, when open, one card per position. The row figure is the sum
 * of its cards, so the rows add up to the DeFi Assets figure.
 */
export function EarnPositionProtocolList({
  protocols,
  expansion,
  pendingCountByProvider,
  onManage,
}: {
  protocols: IEarnProtocolView[];
  expansion: IGroupExpansion;
  pendingCountByProvider?: Record<string, number>;
} & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });

  return (
    <YStack gap="$4">
      {protocols.map((protocol) => (
        <GroupRow
          key={protocol.key}
          name={protocol.name}
          logoURI={protocol.logoURI}
          networkId={protocol.networkId}
          pendingCount={pendingCountByProvider?.[protocol.protocol] ?? 0}
          expanded={expansion.isExpanded(protocol.key)}
          onToggle={() => expansion.toggle(protocol.key)}
          testID={EarnTestIDs.portfolioItem(protocol.name)}
          total={
            <ProtocolValueCell
              value={protocol.value.value}
              currencySymbol={currencyInfo.symbol}
              priceUnavailableLabel={priceUnavailableLabel}
              isUnavailable={!protocol.value.hasAvailableValue}
              size="$bodyLgMedium"
              textAlign="right"
              numberOfLines={1}
            />
          }
        >
          {protocol.positions.map((position) => (
            <EarnPositionCard
              key={position.key}
              position={position}
              onManage={onManage}
            />
          ))}
        </GroupRow>
      ))}
    </YStack>
  );
}
