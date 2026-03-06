import type { IDialogShowProps } from '@onekeyhq/components';
import { IMPL_TRON } from '@onekeyhq/shared/src/engine/engineConsts';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { TronResourceBannerCard, showTronResourceDetailsDialog } from './TronResource';

export const showResourceDetailsDialog = (
  props: IDialogShowProps & {
    accountId: string;
    networkId: string;
  },
) => {
  const { networkId } = props;

  const impl = networkUtils.getNetworkImpl({ networkId });

  switch (impl) {
    case IMPL_TRON:
      return showTronResourceDetailsDialog(props);
    default:
      return null;
  }
};

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
      return <TronResourceBannerCard accountId={accountId} networkId={networkId} />;
    default:
      return null;
  }
}
