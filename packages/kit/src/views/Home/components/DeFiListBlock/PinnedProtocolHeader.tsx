import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { ProtocolHeaderRow } from './ProtocolHeaderRow';

export type IPinnedProtocolHeaderProps = {
  protocol: IDeFiProtocol;
  protocolInfo: IProtocolSummary | undefined;
  netWorth: number | string;
  currencySymbol: string;
  isAllNetworks?: boolean;
  onToggle: () => void;
  reducedMotion?: boolean;
};

function PinnedProtocolHeader({
  protocol,
  protocolInfo,
  netWorth,
  currencySymbol,
  isAllNetworks,
  onToggle,
  reducedMotion,
}: IPinnedProtocolHeaderProps) {
  const intl = useIntl();
  const name = protocolInfo?.protocolName ?? protocol.protocol;
  const logo = protocolInfo?.protocolLogo;
  const positionCountText = useMemo(
    () =>
      `${protocol.positions.length} ${intl.formatMessage({
        id: ETranslations.earn_positions,
      })}`,
    [intl, protocol.positions.length],
  );

  return (
    <ProtocolHeaderRow
      compactProgress={1}
      overlay
      name={name}
      logo={logo}
      networkId={protocol.networkId}
      currencySymbol={currencySymbol}
      netWorth={netWorth}
      isAllNetworks={isAllNetworks}
      positionCountText={positionCountText}
      open
      reducedMotion={reducedMotion}
      onPress={onToggle}
    />
  );
}

export { PinnedProtocolHeader };
