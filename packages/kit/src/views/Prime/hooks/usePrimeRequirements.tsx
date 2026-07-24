/* cspell:ignore Infini */
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { LazyLoadPage } from '../../../components/LazyLoadPage';
import { usePrimePurchaseCallback } from '../components/PrimePurchaseDialog/PrimePurchaseDialog';

import { getPrimePaymentApiKey } from './getPrimePaymentApiKey';

import type { ISubscriptionPeriod } from './usePrimePaymentTypes';

const PrimePurchaseDialog = LazyLoadPage(
  () => import('../components/PrimePurchaseDialog/PrimePurchaseDialog'),
  100,
  true,
);

export function usePrimeRequirements({
  onPurchase,
}: {
  onPurchase?: () => void | Promise<void>;
} = {}) {
  const { user, loginOneKeyId } = useOneKeyAuth();

  const { purchase } = usePrimePurchaseCallback({ onPurchase });

  const intl = useIntl();
  const ensureOneKeyIDLoggedIn = useCallback(
    async ({
      skipDialogConfirm,
    }: {
      skipDialogConfirm?: boolean;
    } = {}) => {
      const isLoggedInInBackground: boolean =
        await backgroundApiProxy.servicePrime.isLoggedIn();
      if (!isLoggedInInBackground) {
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
    [intl, loginOneKeyId],
  );

  const ensurePrimeSubscriptionActive = useCallback(
    async ({
      skipDialogConfirm,
      selectedSubscriptionPeriod,
      featureName,
    }: {
      skipDialogConfirm?: boolean;
      selectedSubscriptionPeriod?: ISubscriptionPeriod;
      featureName?: EPrimeFeatures;
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
          if (isSandboxKey && !user.isEnableSandboxPay) {
            Toast.error({
              title: 'Your account is not eligible for sandbox payment',
            });
            return;
          }
          if (selectedSubscriptionPeriod) {
            await purchase({
              selectedSubscriptionPeriod,
              featureName,
            });
          } else {
            const _purchaseDialog = Dialog.show({
              renderContent: (
                <PrimePurchaseDialog
                  onPurchase={() => {
                    return _purchaseDialog.close();
                  }}
                  featureName={featureName}
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
