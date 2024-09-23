import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

export function useEarnTxLabel() {
  const intl = useIntl();
  return useCallback(
    (label: string) => {
      const labelMaps: Record<string, string> = {
        'stake': intl.formatMessage({ id: ETranslations.earn_stake }),
        'redeem': intl.formatMessage({ id: ETranslations.earn_redeem }),
        'withdraw': intl.formatMessage({ id: ETranslations.global_withdraw }),
        'claim': intl.formatMessage({ id: ETranslations.earn_claim }),
      };
      return labelMaps[label.toLowerCase()] ?? label;
    },
    [intl],
  );
}
