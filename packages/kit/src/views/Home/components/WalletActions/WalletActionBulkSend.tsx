import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Badge } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { canAccessBulkSend } from '../../../BulkSend/access';
import { useBulkSendModeDialog } from '../../../BulkSend/hooks/useBulkSendModeDialog';
import { useNavigateToBulkSend } from '../../../BulkSend/hooks/useNavigateToBulkSend';
import { usePrimeAvailable } from '../../../Prime/hooks/usePrimeAvailable';

export function WalletActionBulkSend({ onClose }: { onClose: () => void }) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { network, account, indexedAccount } = activeAccount;

  const { user, isPrimeActive } = useOneKeyAuth();
  const hasBulkSendAccess = canAccessBulkSend({
    isE2E: platformEnv.isE2E === true,
    isPrimeActive,
    oneKeyUserId: user?.onekeyUserId,
  });
  const { isPrimeAvailable } = usePrimeAvailable();

  const navigateToBulkSend = useNavigateToBulkSend();
  const showBulkSendModeDialog = useBulkSendModeDialog();

  const handleBulkSend = useCallback(async () => {
    onClose();
    await timerUtils.wait(150);

    if (!hasBulkSendAccess) {
      defaultLogger.prime.subscription.primeEntryClick({
        featureName: EPrimeFeatures.BulkSend,
        entryPoint: 'moreActions',
        isPrimeActive,
      });
      navigation.pushFullModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDashboard,
        params: {
          fromFeature: EPrimeFeatures.BulkSend,
        },
      });
      return;
    }

    showBulkSendModeDialog({
      onSelect: (mode) => {
        void navigateToBulkSend({
          networkId: network?.id,
          accountId: account?.id,
          indexedAccountId: indexedAccount?.id,
          bulkSendMode: mode,
        });
      },
    });
  }, [
    onClose,
    isPrimeActive,
    hasBulkSendAccess,
    navigateToBulkSend,
    showBulkSendModeDialog,
    navigation,
    network?.id,
    account?.id,
    indexedAccount?.id,
  ]);

  if (!platformEnv.isE2E && !isPrimeAvailable) {
    return null;
  }

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
        hasBulkSendAccess ? null : (
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
