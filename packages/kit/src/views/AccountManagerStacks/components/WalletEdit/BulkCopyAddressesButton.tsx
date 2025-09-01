import { useIntl } from 'react-intl';

import { ActionList, Badge, Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalBulkCopyAddressesRoutes } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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
  const actions = useAccountSelectorActions();

  return (
    <ActionList.Item
      icon="Copy3Outline"
      label={intl.formatMessage({
        id: ETranslations.global_bulk_copy_addresses,
      })}
      onPress={async () => {
        if (!isPrimeUser) {
          navigation?.pushFullModal(EModalRoutes.PrimeModal, {
            screen: EPrimePages.PrimeFeatures,
            params: {
              showAllFeatures: false,
              selectedFeature: EPrimeFeatures.BulkCopyAddresses,
              selectedSubscriptionPeriod: 'P1Y',
              networkId,
            },
          });
          return;
        }

        const fallbackNetworkId = networkUtils.toNetworkIdFallback({
          networkId,
          allNetworkFallbackToBtc: true,
        });

        if (
          wallet?.isMocked &&
          accountUtils.isHwWallet({
            walletId: wallet?.id,
          })
        ) {
          const device =
            await backgroundApiProxy.serviceAccount.getWalletDeviceSafe({
              dbWallet: wallet,
              walletId: wallet?.id,
            });
          Dialog.show({
            icon: 'InfoCircleOutline',
            title: intl.formatMessage({
              id: ETranslations.global_bulk_copy_addresses_no_wallet_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.global_bulk_copy_addresses_no_wallet_description,
            }),
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_bulk_copy_addresses_no_wallet_main_button,
            }),
            onConfirm: () => {
              if (!device?.featuresInfo) {
                Toast.error({
                  title: 'Error',
                  message: 'No device features found',
                });
                return;
              }

              void actions.current.createHWWalletWithoutHidden({
                device,
                features: device?.featuresInfo,
              });
            },
            onCancelText: intl.formatMessage({
              id: ETranslations.global_bulk_copy_addresses_no_wallet_secondary_button,
            }),
            onCancel: () => {
              if (fallbackNetworkId) {
                navigation.pushModal(EModalRoutes.BulkCopyAddressesModal, {
                  screen: EModalBulkCopyAddressesRoutes.BulkCopyAddressesModal,
                  params: {
                    walletId: '',
                    networkId: fallbackNetworkId,
                  },
                });
              }
            },
          });
          return;
        }

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
        isPrimeUser ? null : (
          <Badge badgeSize="sm" badgeType="default">
            <Badge.Text>
              {intl.formatMessage({
                id: ETranslations.prime_status_prime,
              })}
            </Badge.Text>
          </Badge>
        )
      }
    />
  );
}
