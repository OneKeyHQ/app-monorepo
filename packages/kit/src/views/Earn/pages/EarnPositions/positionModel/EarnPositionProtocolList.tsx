import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { YStack } from '@onekeyhq/components';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { GroupRow } from '../mobile/GroupRow';

import { EarnPositionCard } from './EarnPositionCard';

import type { IEarnPositionCardHandlers } from './EarnPositionCard';
import type { IEarnProtocolView } from './earnPositionModel';

/**
 * Protocol rows (one per protocol per network, the network on the logo badge)
 * and, when open, one card per position. The row figure is the sum of its
 * cards, so the rows add up to the DeFi Assets figure.
 */
export function EarnPositionProtocolList({
  protocols,
  expandAll = false,
  onManage,
  onClaim,
}: {
  protocols: IEarnProtocolView[];
  /** the page opens the first row only; the reference opens all of them */
  expandAll?: boolean;
} & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isExpanded = useCallback(
    (key: string, index: number) =>
      overrides[key] ?? (expandAll || index === 0),
    [expandAll, overrides],
  );
  const toggle = useCallback(
    (key: string, index: number) =>
      setOverrides((prev) => ({
        ...prev,
        [key]: !(prev[key] ?? (expandAll || index === 0)),
      })),
    [expandAll],
  );
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });

  return (
    <YStack gap="$4">
      {protocols.map((protocol, index) => (
        <GroupRow
          key={protocol.key}
          name={protocol.name}
          logoURI={protocol.logoURI}
          networkId={protocol.networkId}
          expanded={isExpanded(protocol.key, index)}
          onToggle={() => toggle(protocol.key, index)}
          testID={`earn-position-protocol-${protocol.key}`}
          total={
            <ProtocolValueCell
              value={protocol.value.value}
              currencySymbol={settings.currencyInfo.symbol}
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
              onClaim={onClaim}
            />
          ))}
        </GroupRow>
      ))}
    </YStack>
  );
}
