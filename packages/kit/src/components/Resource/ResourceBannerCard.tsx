import { IMPL_TRON } from '@onekeyhq/shared/src/engine/engineConsts';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { TronResourceBannerCard } from './TronResource';

export function ResourceBannerCard({
  accountId,
  networkId,
  width,
  height,
}: {
  accountId: string;
  networkId: string;
  width: number;
  height: number;
}) {
  const impl = networkUtils.getNetworkImpl({ networkId });

  switch (impl) {
    case IMPL_TRON:
      return (
        <TronResourceBannerCard
          accountId={accountId}
          networkId={networkId}
          width={width}
          height={height}
        />
      );
    default:
      return null;
  }
}
