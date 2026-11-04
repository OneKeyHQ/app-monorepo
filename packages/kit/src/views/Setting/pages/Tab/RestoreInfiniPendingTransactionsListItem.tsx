/* cspell:ignore Infini */
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TabSettingsListItem } from './ListItem';

import type { ICustomElementProps } from './CustomElement';

export function RestoreInfiniPendingTransactionsListItem({
  logItemClick,
  ...props
}: ICustomElementProps) {
  const intl = useIntl();
  const onPress = useCallback(async () => {
    logItemClick?.();
    const recoveries =
      await backgroundApiProxy.simpleDb.prime.getInfiniPendingTransactionRecoveries();
    if (!recoveries.length) {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.tray_no_pending_transactions_desc,
        }),
        showCancelButton: false,
        onConfirmText: intl.formatMessage({ id: ETranslations.global_ok }),
      });
      return;
    }
    Dialog.show({
      title: `Infini: ${intl.formatMessage({ id: ETranslations.tray_pending_transactions_title })}`,
      description: `${intl.formatMessage({ id: ETranslations.global_restore })} (${recoveries.length})`,
      onConfirmText: intl.formatMessage({ id: ETranslations.global_restore }),
      onConfirm: async () => {
        // This only restores local history. Signing/cancellation still require
        // the existing transaction confirmation and its chain nonce precheck.
        await backgroundApiProxy.serviceSend.restoreInfiniPendingTransactions();
        Toast.success({
          title: intl.formatMessage({ id: ETranslations.global_success }),
        });
      },
    });
  }, [intl, logItemClick]);
  return <TabSettingsListItem {...props} onPress={onPress} drillIn />;
}
