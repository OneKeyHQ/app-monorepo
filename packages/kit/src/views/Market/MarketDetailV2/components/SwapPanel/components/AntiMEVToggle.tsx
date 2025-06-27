import { useIntl } from 'react-intl';

import { Switch, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { InfoItemLabel } from './InfoItemLabel';

export interface IAntiMEVToggleProps {
  value: boolean;
  onToggle: () => void;
  networkId?: string;
}

export function AntiMEVToggle({
  value,
  onToggle,
  networkId,
}: IAntiMEVToggleProps) {
  const intl = useIntl();

  const { result: swapConfigs, isLoading } = usePromiseResult(
    async () => {
      const configs = await backgroundApiProxy.serviceSwap.fetchSwapConfigs();
      return configs;
    },
    [],
    {
      watchLoading: true,
    },
  );

  // swapConfigs.swapMevNetConfig
  // [
  //   "evm--1",
  //   "evm--56",
  //   "evm--8453",
  //   "sui--mainnet",
  //   "sol--101"
  // ]

  // Check if MEV is available for the current network
  const mevAvailable =
    networkId && swapConfigs?.swapMevNetConfig?.includes?.(networkId);

  // Don't render if MEV is not available for current network or still loading
  if (isLoading || !mevAvailable) {
    return null;
  }

  return (
    <XStack justifyContent="space-between" alignItems="center">
      <InfoItemLabel
        title={intl.formatMessage({ id: ETranslations.mev_protection_label })}
      />

      <Switch size="small" value={value} onChange={onToggle} />
    </XStack>
  );
}
