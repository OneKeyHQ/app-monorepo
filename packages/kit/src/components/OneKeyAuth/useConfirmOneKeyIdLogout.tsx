import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useOneKeyAuthMethods } from './useOneKeyAuth';

type IUseConfirmOneKeyIdLogoutOptions = {
  reason: string;
  onBeforeLogout?: () => void | Promise<void>;
  onSuccess?: () => void | Promise<void>;
};

export function useConfirmOneKeyIdLogout({
  reason,
  onBeforeLogout,
  onSuccess,
}: IUseConfirmOneKeyIdLogoutOptions) {
  const intl = useIntl();
  const { logoutWithPurchasesSdk } = useOneKeyAuthMethods();

  return useCallback(() => {
    Dialog.show({
      icon: 'InfoCircleOutline',
      title: intl.formatMessage({
        id: ETranslations.prime_onekeyid_log_out,
      }),
      description: intl.formatMessage({
        id: ETranslations.prime_onekeyid_log_out_description,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.prime_log_out,
      }),
      onConfirm: async () => {
        await onBeforeLogout?.();
        defaultLogger.prime.subscription.onekeyIdLogout({
          reason,
        });
        await logoutWithPurchasesSdk();
        await onSuccess?.();
      },
    });
  }, [intl, logoutWithPurchasesSdk, onBeforeLogout, onSuccess, reason]);
}
