import { uniq } from 'lodash';
import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';

type IBabylonTrackingBaseProps = {
  networkId: string;
  accountId: string;
  symbol: string;
  provider: string;
  onRefresh?: () => void;
};

const BabylonTracking = ({
  networkId,
  accountId,
  symbol,
  provider,
  onRefresh,
}: IBabylonTrackingBaseProps) => {
  const intl = useIntl();
  usePromiseResult(
    async () => {
      const portfolioItems =
        await backgroundApiProxy.serviceStaking.getPortfolioList({
          accountId,
          networkId,
          symbol,
          provider,
        });
      const trackingItems =
        await backgroundApiProxy.serviceStaking.getBabylonTrackingItems({
          accountId,
          networkId,
        });

      const stakeItems = trackingItems.filter((o) => o.action === 'stake');
      const claimItems = trackingItems.filter((o) => o.action === 'claim');

      const now = Date.now();
      const timeoutItemIds = trackingItems
        .filter(
          (o) => now - o.createAt > timerUtils.getTimeDurationMs({ day: 3 }),
        )
        .map((i) => i.txId);

      const removed: string[] = timeoutItemIds;
      stakeItems.forEach(async (stakeItem) => {
        const findStaked = portfolioItems.find(
          (o) => o.txId === stakeItem.txId,
        );
        if (findStaked) {
          removed.push(findStaked.txId);
        }
      });

      claimItems.forEach((claimItem) => {
        const findClaim = portfolioItems.find(
          (o) => o.txId === claimItem.txId && o.status === 'claimed',
        );
        if (findClaim) {
          removed.push(claimItem.txId);
        }
      });

      if (removed.length > 0) {
        await backgroundApiProxy.serviceStaking.removeBabylonTrackingItem({
          txIds: uniq(removed),
        });
        onRefresh?.();
      }
    },
    [networkId, accountId, symbol, provider, onRefresh],
    { pollingInterval: 30 * 1000 },
  );
  return (
    <Alert
      type="info"
      title={intl.formatMessage({
        id: ETranslations.earn_pending_transactions_data_out_of_sync,
      })}
    />
  );
};

export const BabylonTrackingAlert = (props: IBabylonTrackingBaseProps) => {
  const { provider } = props;
  if (provider.toLowerCase() !== EEarnProviderEnum.Babylon.toLowerCase()) {
    return null;
  }
  return <BabylonTracking {...props} />;
};
