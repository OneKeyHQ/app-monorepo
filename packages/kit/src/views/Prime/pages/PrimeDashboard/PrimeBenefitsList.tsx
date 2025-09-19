import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Badge,
  Icon,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';
import { EModalBulkCopyAddressesRoutes } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IPrimeServerUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
import { usePrimeRequirements } from '../../hooks/usePrimeRequirements';

import type { ISubscriptionPeriod } from '../../hooks/usePrimePaymentTypes';

function PrimeBenefitsItem({
  icon,
  title,
  subtitle,
  onPress,
  isComingSoon,
}: {
  icon: IKeyOfIcons;
  title: string;
  subtitle: string;
  onPress: () => void;
  isComingSoon?: boolean;
}) {
  const intl = useIntl();
  return (
    <ListItem drillIn onPress={onPress}>
      <YStack borderRadius="$3" borderCurve="continuous" bg="$brand4" p="$2">
        <Icon name={icon} size="$6" color="$brand9" />
      </YStack>
      <ListItem.Text
        userSelect="none"
        flex={1}
        primary={
          <XStack>
            <SizableText textAlign="left" size="$bodyLgMedium">
              {title}
            </SizableText>
            {isComingSoon ? (
              <Badge ml="$2" badgeSize="sm">
                <Badge.Text>
                  {intl.formatMessage({
                    id: ETranslations.id_prime_soon,
                  })}
                </Badge.Text>
              </Badge>
            ) : null}
          </XStack>
        }
        secondary={subtitle}
      />
    </ListItem>
  );
}

export function PrimeBenefitsList({
  selectedSubscriptionPeriod,
  networkId,
  serverUserInfo,
}: {
  selectedSubscriptionPeriod: ISubscriptionPeriod;
  networkId?: string;
  serverUserInfo?: IPrimeServerUserInfo;
}) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ensureOneKeyIDLoggedIn } = usePrimeRequirements();
  const { isPrimeSubscriptionActive } = usePrimeAuthV2();
  const {
    activeAccount: { wallet, account, network },
  } = useActiveAccount({ num: 0 });

  return (
    <Stack py="$2">
      <PrimeBenefitsItem
        icon="CloudOutline"
        title={intl.formatMessage({
          id: ETranslations.global_onekey_cloud,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.prime_onekey_cloud_desc,
        })}
        onPress={() => {
          if (isPrimeSubscriptionActive) {
            navigation.navigate(EPrimePages.PrimeCloudSync, {
              serverUserInfo,
            });
          } else {
            defaultLogger.prime.subscription.primeEntryClick({
              featureName: EPrimeFeatures.OneKeyCloud,
              entryPoint: 'primePage',
            });
            navigation.navigate(EPrimePages.PrimeFeatures, {
              showAllFeatures: true,
              selectedFeature: EPrimeFeatures.OneKeyCloud,
              selectedSubscriptionPeriod,
              serverUserInfo,
            });
          }
        }}
      />
      {/* <PrimeBenefitsItem
        icon="MultipleDevicesOutline"
        title={intl.formatMessage({
          id: ETranslations.global_prime_device_management,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.prime_device_management_desc,
        })}
        onPress={async () => {
          if (isPrimeSubscriptionActive) {
            await ensureOneKeyIDLoggedIn();
            navigation.pushFullModal(EModalRoutes.PrimeModal, {
              screen: EPrimePages.PrimeDeviceLimit,
            });
          } else {
            navigation.navigate(EPrimePages.PrimeFeatures, {
              showAllFeatures: true,
              selectedFeature: EPrimeFeatures.DeviceManagement,
              selectedSubscriptionPeriod,
              serverUserInfo,
            });
          }
        }}
      /> */}
      <PrimeBenefitsItem
        icon="Copy3Outline"
        title={intl.formatMessage({
          id: ETranslations.global_bulk_copy_addresses,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.prime_bulk_copy_addresses_desc,
        })}
        onPress={() => {
          if (isPrimeSubscriptionActive) {
            const fallbackNetworkId = networkUtils.toNetworkIdFallback({
              networkId,
              allNetworkFallbackToBtc: true,
            });
            navigation.navigate(EModalRoutes.BulkCopyAddressesModal, {
              screen: EModalBulkCopyAddressesRoutes.BulkCopyAddressesModal,
              params: {
                networkId: fallbackNetworkId,
              },
            });
          } else {
            defaultLogger.prime.subscription.primeEntryClick({
              featureName: EPrimeFeatures.BulkCopyAddresses,
              entryPoint: 'primePage',
            });
            navigation.navigate(EPrimePages.PrimeFeatures, {
              showAllFeatures: true,
              selectedFeature: EPrimeFeatures.BulkCopyAddresses,
              selectedSubscriptionPeriod,
              serverUserInfo,
            });
          }
        }}
      />
      <PrimeBenefitsItem
        icon="FlashOutline"
        title={intl.formatMessage({
          id: ETranslations.global_bulk_revoke,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.global_bulk_revoke_desc,
        })}
        onPress={() => {
          if (isPrimeSubscriptionActive) {
            navigation.navigate(EModalRoutes.ApprovalManagementModal, {
              screen: EModalApprovalManagementRoutes.ApprovalList,
              params: {
                walletId: wallet?.id ?? '',
                accountId: account?.id ?? '',
                networkId: network?.id ?? '',
              },
            });
          } else {
            defaultLogger.prime.subscription.primeEntryClick({
              featureName: EPrimeFeatures.BulkRevoke,
              entryPoint: 'primePage',
            });
            navigation.navigate(EPrimePages.PrimeFeatures, {
              showAllFeatures: true,
              selectedFeature: EPrimeFeatures.BulkRevoke,
              selectedSubscriptionPeriod,
              serverUserInfo,
            });
          }
        }}
      />

      <PrimeBenefitsItem
        icon="BellOutline"
        title={intl.formatMessage({
          id: ETranslations.global_multi_account_notification,
        })}
        subtitle={intl.formatMessage(
          {
            id: ETranslations.global_on_chain_notifications_description,
          },
          {
            number: 100,
          },
        )}
        onPress={() => {
          if (isPrimeSubscriptionActive) {
            navigation.navigate(EModalRoutes.NotificationsModal);
          } else {
            defaultLogger.prime.subscription.primeEntryClick({
              featureName: EPrimeFeatures.Notifications,
              entryPoint: 'primePage',
            });
            navigation.navigate(EPrimePages.PrimeFeatures, {
              showAllFeatures: true,
              selectedFeature: EPrimeFeatures.Notifications,
              selectedSubscriptionPeriod,
              serverUserInfo,
            });
          }
        }}
      />

      <PrimeBenefitsItem
        isComingSoon
        icon="ClockTimeHistoryOutline"
        title={intl.formatMessage({
          id: ETranslations.global_export_transaction_history,
        })}
        subtitle={intl.formatMessage(
          {
            id: ETranslations.wallet_export_on_chain_transactions_description,
          },
          {
            networkCount: 12,
          },
        )}
        onPress={() => {
          defaultLogger.prime.subscription.primeEntryClick({
            featureName: EPrimeFeatures.HistoryExport,
            entryPoint: 'primePage',
          });
          navigation.navigate(EPrimePages.PrimeFeatures, {
            showAllFeatures: true,
            selectedFeature: EPrimeFeatures.HistoryExport,
            selectedSubscriptionPeriod,
            serverUserInfo,
          });
        }}
      />

      {platformEnv.isDev ? (
        <>
          <PrimeBenefitsItem
            isComingSoon
            icon="BezierNodesOutline"
            title="Premium RPC"
            subtitle="Enjoy rapid and secure blockchain access."
            onPress={() => {
              if (process.env.NODE_ENV !== 'production') {
                Toast.success({
                  title: 'Premium RPC',
                });
              }
            }}
          />
          <PrimeBenefitsItem
            isComingSoon
            icon="FileTextOutline"
            title="Analytics"
            subtitle="sint occaecat cupidatat non proident"
            onPress={() => {
              if (process.env.NODE_ENV !== 'production') {
                Toast.success({
                  title: 'Analytics',
                });
              }
            }}
          />
        </>
      ) : null}
    </Stack>
  );
}
