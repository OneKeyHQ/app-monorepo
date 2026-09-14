import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

export function confirmClearOneKeyIdCache({
  intl,
}: {
  intl: IntlShape;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (confirmed: boolean) => {
      if (!resolved) {
        resolved = true;
        resolve(confirmed);
      }
    };

    Dialog.show({
      icon: 'ErrorOutline',
      tone: 'destructive',
      title: intl.formatMessage({
        id: ETranslations.prime_onekeyid_log_out,
      }),
      description: intl.formatMessage({
        id: ETranslations.prime_onekeyid_log_out_description,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_logout,
      }),
      onCancelText: intl.formatMessage({
        id: ETranslations.global_cancel,
      }),
      onConfirm: async ({ close }) => {
        safeResolve(true);
        await close?.();
      },
      onCancel: () => safeResolve(false),
      onClose: () => safeResolve(false),
    });
  });
}
