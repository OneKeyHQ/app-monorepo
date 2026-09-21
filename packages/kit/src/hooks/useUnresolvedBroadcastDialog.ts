import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function useUnresolvedBroadcastDialog(onRefresh: () => void) {
  const intl = useIntl();
  return useCallback(() => {
    Dialog.confirm({
      title: intl.formatMessage({ id: ETranslations.global_retry }),
      description: intl.formatMessage({
        id: ETranslations.global_an_error_occurred_desc,
      }),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_refresh }),
      onConfirm: onRefresh,
    });
  }, [intl, onRefresh]);
}
