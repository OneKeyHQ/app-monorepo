import { Fragment } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { insertByValue } from '../../../pools/usePoolsPortfolio';
import { EarnTestIDs } from '../../../testIDs';

import { EarnPositionCard } from './EarnPositionCard';
import { GroupRow } from './GroupRow';

import type { IEarnPositionCardHandlers } from './EarnPositionCard';
import type { IEarnProtocolView } from './earnPositionModel';
import type { IGroupExpansion } from './GroupRow';

/** A protocol row from outside the Earn positions, e.g. Pools (Uniswap) */
export type IExtraProtocolRow = {
  key: string;
  /** In the user's currency, to place the row among the others */
  value: number;
  node: ReactNode;
};

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
  onRedeem,
  extraRows = [],
}: {
  protocols: IEarnProtocolView[];
  expansion: IGroupExpansion;
  pendingCountByProvider?: Record<string, number>;
  extraRows?: IExtraProtocolRow[];
} & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });

  const protocolRows = protocols.map((protocol) => ({
    key: protocol.key,
    value: protocol.value.value,
    node: (
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
            onRedeem={onRedeem}
          />
        ))}
      </GroupRow>
    ),
  }));

  // Extra rows slot in by value; the protocols keep their own order
  const rows = insertByValue<IExtraProtocolRow>(
    protocolRows,
    extraRows,
    (row) => row.value,
  );

  return (
    <YStack gap="$4">
      {rows.map((row) => (
        <Fragment key={row.key}>{row.node}</Fragment>
      ))}
    </YStack>
  );
}
