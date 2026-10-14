import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Badge } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorLazyAction } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actionsLazy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { canAccessBulkSend } from '../../../BulkSend/access';
import { useBulkSendModeDialog } from '../../../BulkSend/hooks/useBulkSendModeDialog';
import { useNavigateToBulkSend } from '../../../BulkSend/hooks/useNavigateToBulkSend';
import { usePrimeAvailable } from '../../../Prime/hooks/usePrimeAvailable';
import { usePrimeFeatureAccess } from '../../../Prime/hooks/usePrimeFeatureAccess';

export function WalletActionBulkSend({ onClose }: { onClose: () => void }) {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { network, account, indexedAccount, wallet } = activeAccount;
  const runAccountSelectorAction = useAccountSelectorLazyAction();

  const { user, isPrimeActive, isPrimeSubscriptionActive } = useOneKeyAuth();
  // Access without free-trial metering (E2E / Prime); free users go through
  // the gate.
  const hasBulkSendAccess = canAccessBulkSend({
    isE2E: platformEnv.isE2E === true,
    isPrimeActive: Boolean(isPrimeSubscriptionActive),
    oneKeyUserId: user?.onekeyUserId,
  });
  const { ensureFeatureAccess } = usePrimeFeatureAccess();
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
      // The bulk send pages open in the extension expand tab, which runs
      // the login and page-level gate itself.
      const access = await ensureFeatureAccess({
        featureId: EPrimeFeatures.BulkSend,
        networkId: network?.id,
        deferQuotaCheck: true,
        // A wallet, network or account switched while the gate waited drops
        // the press. This item unmounts with the menu, so the latest
        // selection is read from the account selector store.
        isContextValid: async () => {
          const latest: IAccountSelectorActiveAccountInfo =
            await runAccountSelectorAction('getActiveAccount', { num: 0 });
          return (
            latest.wallet?.id === wallet?.id &&
            latest.network?.id === network?.id &&
            latest.account?.id === account?.id &&
            latest.indexedAccount?.id === indexedAccount?.id
          );
        },
        extPopup: { mode: 'passThrough' },
      });
      if (!access.granted) {
        return;
      }
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
    ensureFeatureAccess,
    runAccountSelectorAction,
    wallet?.id,
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
