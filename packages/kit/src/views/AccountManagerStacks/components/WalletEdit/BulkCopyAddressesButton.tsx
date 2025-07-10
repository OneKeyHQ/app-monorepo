import { useIntl } from 'react-intl';

import { ActionList, Badge } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalBulkCopyAddressesRoutes } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

export function BulkCopyAddressesButton({
  wallet,
  onClose,
  networkId,
  isPrimeUser,
}: {
  wallet: IDBWallet | undefined;
  networkId: string;
  isPrimeUser: boolean;
  onClose: () => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  return (
    <ActionList.Item
      icon="Copy3Outline"
      label={intl.formatMessage({
        id: ETranslations.global_bulk_copy_addresses,
      })}
      onPress={async () => {
        if (!isPrimeUser) {
          navigation.pushFullModal(EModalRoutes.PrimeModal, {
            screen: EPrimePages.PrimeDashboard,
          });
          return;
        }

        const fallbackNetworkId = networkUtils.toNetworkIdFallback({
          networkId,
          allNetworkFallbackToBtc: true,
        });
        if (fallbackNetworkId) {
          navigation.pushModal(EModalRoutes.BulkCopyAddressesModal, {
            screen: EModalBulkCopyAddressesRoutes.BulkCopyAddressesModal,
            params: {
              walletId: wallet?.id || '',
              networkId: fallbackNetworkId,
            },
          });
        }
      }}
      onClose={onClose}
      extra={
        <Badge badgeSize="sm" badgeType="default">
          <Badge.Text>
            {intl.formatMessage({
              id: ETranslations.prime_status_prime,
            })}
          </Badge.Text>
        </Badge>
      }
    />
  );
}
