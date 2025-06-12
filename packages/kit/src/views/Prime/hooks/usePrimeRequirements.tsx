import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { LazyLoadPage } from '../../../components/LazyLoadPage';
import { useLoginOneKeyId } from '../../../hooks/useLoginOneKeyId';
import { usePrimePurchaseCallback } from '../components/PrimePurchaseDialog/PrimePurchaseDialog';

import { getPrimePaymentApiKey } from './getPrimePaymentApiKey';
import { usePrimeAuthV2 } from './usePrimeAuthV2';

import type { ISubscriptionPeriod } from './usePrimePaymentTypes';

const PrimePurchaseDialog = LazyLoadPage(
  () => import('../components/PrimePurchaseDialog/PrimePurchaseDialog'),
  100,
  true,
);

export function usePrimeRequirements() {
  const { user, isLoggedIn, logout } = usePrimeAuthV2();
  const { loginOneKeyId } = useLoginOneKeyId();

  const { purchase } = usePrimePurchaseCallback();

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
        // logout before login, make sure local privy cache is cleared
        void logout();

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
        throw new OneKeyLocalError('Prime is not logged in');
      }
    },
    [isLoggedIn, logout, intl, loginOneKeyId],
  );

  const ensurePrimeSubscriptionActive = useCallback(
    async ({
      skipDialogConfirm,
      selectedSubscriptionPeriod,
    }: {
      skipDialogConfirm?: boolean;
      selectedSubscriptionPeriod?: ISubscriptionPeriod;
    } = {}) => {
      await ensureOneKeyIDLoggedIn({
        skipDialogConfirm,
      });
      const isPrimeSubscriptionActive: boolean =
        await backgroundApiProxy.servicePrime.isPrimeSubscriptionActive();
      if (!isPrimeSubscriptionActive) {
        const onConfirm = async () => {
          const { isSandboxKey } = await getPrimePaymentApiKey({
            apiKeyType: 'web',
          });
          if (
            platformEnv.isRuntimeBrowser &&
            isSandboxKey &&
            !user.isEnableSandboxPay
          ) {
            Toast.error({
              title: 'Your account is not eligible for sandbox payment',
            });
          }
          if (selectedSubscriptionPeriod) {
            await purchase({
              selectedSubscriptionPeriod,
            });
          } else {
            const purchaseDialog = Dialog.show({
              renderContent: (
                <PrimePurchaseDialog
                  onPurchase={() => {
                    void purchaseDialog.close();
                  }}
                />
              ),
            });
          }
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
        throw new OneKeyLocalError('Prime subscription is not active');
      }
    },
    [ensureOneKeyIDLoggedIn, intl, purchase, user.isEnableSandboxPay],
  );

  return {
    ensureOneKeyIDLoggedIn,
    ensurePrimeSubscriptionActive,
  };
}
