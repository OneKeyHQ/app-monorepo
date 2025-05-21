import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { LazyLoadPage } from '../../../components/LazyLoadPage';
import { useLoginOneKeyId } from '../../../hooks/useLoginOneKeyId';

import { usePrimeAuthV2 } from './usePrimeAuthV2';

const PrimePurchaseDialog = LazyLoadPage(
  () => import('../components/PrimePurchaseDialog/PrimePurchaseDialog'),
  100,
  true,
);

export function usePrimeRequirements() {
  const { isLoggedIn } = usePrimeAuthV2();
  const { loginOneKeyId } = useLoginOneKeyId();

  const intl = useIntl();
  const ensureOneKeyIDLoggedIn = useCallback(
    async ({
      skipDialogConfirm,
    }: {
      skipDialogConfirm?: boolean;
    } = {}) => {
      const isLoggedInInBackground: boolean =
        await backgroundApiProxy.servicePrime.isLoggedIn();
      if (!isLoggedInInBackground || !isLoggedIn) {
        const onConfirm = async () => {
          await loginOneKeyId();
        };
        if (!skipDialogConfirm) {
          const dialog = Dialog.show({
            title: intl.formatMessage({
              id: ETranslations.prime_not_logged_in_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.prime_not_logged_in_description,
            }),
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_continue,
            }),
            onConfirm: async () => {
              await dialog.close();
              await onConfirm();
            },
          });
        } else {
          await onConfirm();
        }
        throw new Error('Prime is not logged in');
      }
    },
    [isLoggedIn, intl, loginOneKeyId],
  );

  const ensurePrimeSubscriptionActive = useCallback(
    async ({
      skipDialogConfirm,
    }: {
      skipDialogConfirm?: boolean;
    } = {}) => {
      await ensureOneKeyIDLoggedIn({
        skipDialogConfirm,
      });
      const isPrimeSubscriptionActive: boolean =
        await backgroundApiProxy.servicePrime.isPrimeSubscriptionActive();
      if (!isPrimeSubscriptionActive) {
        const onConfirm = async () => {
          const purchaseDialog = Dialog.show({
            renderContent: (
              <PrimePurchaseDialog
                onPurchase={() => {
                  void purchaseDialog.close();
                }}
              />
            ),
          });
        };
        if (!skipDialogConfirm) {
          const dialog = Dialog.show({
            title: intl.formatMessage({
              id: ETranslations.prime_not_subscribed_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.prime_not_subscribed_description,
            }),
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_continue,
            }),
            onConfirm: async () => {
              await dialog.close();
              await onConfirm();
            },
          });
        } else {
          await onConfirm();
        }
        throw new Error('Prime subscription is not active');
      }
    },
    [ensureOneKeyIDLoggedIn, intl],
  );

  return {
    ensureOneKeyIDLoggedIn,
    ensurePrimeSubscriptionActive,
  };
}
