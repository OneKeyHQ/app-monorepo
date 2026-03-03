import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Badge } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useNavigateToBulkSend } from '../../../BulkSend/hooks/useNavigateToBulkSend';

export function WalletActionBulkSend({ onClose }: { onClose: () => void }) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { network, account, indexedAccount } = activeAccount;

  const { user } = useOneKeyAuth();
  const isPrimeUser = user?.primeSubscription?.isActive && user?.onekeyUserId;

  const navigateToBulkSend = useNavigateToBulkSend();

  const handleBulkSend = useCallback(async () => {
    onClose();
    await timerUtils.wait(150);

    if (!isPrimeUser) {
      defaultLogger.prime.subscription.primeEntryClick({
        featureName: EPrimeFeatures.BulkSend,
        entryPoint: 'moreActions',
      });
      navigation.pushModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeFeatures,
        params: {
          showAllFeatures: false,
          selectedFeature: EPrimeFeatures.BulkSend,
          selectedSubscriptionPeriod: 'P1Y',
        },
      });
      return;
    }

    void navigateToBulkSend({
      networkId: network?.id,
      accountId: account?.id,
      indexedAccountId: indexedAccount?.id,
    });
  }, [
    onClose,
    isPrimeUser,
    navigateToBulkSend,
    navigation,
    network?.id,
    account?.id,
    indexedAccount?.id,
  ]);

  return (
    <ActionList.Item
      trackID="wallet-action-bulk-send"
      icon="ChevronDoubleUpOutline"
      label={intl.formatMessage({
        id: ETranslations.wallet_bulk_send_title,
      })}
      onClose={() => {}}
      onPress={handleBulkSend}
      extra={
        isPrimeUser ? null : (
          <Badge badgeSize="sm" badgeType="default">
            <Badge.Text size="$bodySmMedium">
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
