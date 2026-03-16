import { IMPL_TRON } from '@onekeyhq/shared/src/engine/engineConsts';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { TronResourceBannerCard } from './TronResource';

export function ResourceBannerCard({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const impl = networkUtils.getNetworkImpl({ networkId });

  switch (impl) {
    case IMPL_TRON:
      return (
        <TronResourceBannerCard accountId={accountId} networkId={networkId} />
      );
    default:
      return null;
  }
}
