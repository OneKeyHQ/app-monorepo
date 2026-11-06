import type { IYStackProps } from '@onekeyhq/components';
import { IMPL_TRON } from '@onekeyhq/shared/src/engine/engineConsts';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { TronResourceBannerCard } from './TronResource';

export function ResourceBannerCard({
  accountId,
  networkId,
  width,
  height,
  cardProps,
}: {
  accountId: string;
  networkId: string;
  width: number;
  height: number;
  cardProps?: IYStackProps;
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
          cardProps={cardProps}
        />
      );
    default:
      return null;
  }
}
