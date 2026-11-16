import { useIntl } from 'react-intl';

import { Alert, Toast, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { etherFiDepositRecovery } from '../hooks/etherFiDepositRecovery';
import { refreshEtherFiNativeDepositRecovery } from '../hooks/useEtherFiNativeDepositRecovery';

import type { IEtherFiDepositRecovery } from '../hooks/etherFiDepositRecovery';

export function EtherFiNativeDepositRecoveryNotice({
  records,
  loading,
  onResume,
}: {
  records: IEtherFiDepositRecovery[];
  loading: boolean;
  onResume: (id: symbol) => Promise<void>;
}) {
  const intl = useIntl();
  if (!records.length) return null;
  return (
    <YStack gap="$2">
      {records.map((record) => {
        const ready =
          record.status === 'ready' ||
          (record.status === 'failed' && record.phase !== 'wrap');
        const done =
          record.status === 'completed' ||
          (record.status === 'failed' && record.phase === 'wrap');
        const canCheck = record.status === 'confirming' && Boolean(record.txid);
        let titleId = ETranslations.global_pending;
        if (record.status === 'completed') titleId = ETranslations.global_done;
        if (record.status === 'failed') titleId = ETranslations.global_failed;
        if (record.status === 'ready') titleId = ETranslations.global_success;
        const title = intl.formatMessage({ id: titleId });
        const phase =
          record.phase === 'wrap'
            ? intl.formatMessage(
                { id: ETranslations.Limit_native_token_no_sell_wrap },
                { token: 'WETH' },
              )
            : intl.formatMessage({
                id:
                  record.phase === 'approve'
                    ? ETranslations.global_approve
                    : ETranslations.earn_deposit,
              });
        let action: { primary: string; onPrimaryPress: () => void } | undefined;
        if (ready) {
          action = {
            primary: intl.formatMessage({
              id: ETranslations.global_continue,
            }),
            onPrimaryPress: () => {
              if (!loading) void onResume(record.id);
            },
          };
        } else if (canCheck) {
          action = {
            primary: intl.formatMessage({ id: ETranslations.global_retry }),
            onPrimaryPress: () => {
              void refreshEtherFiNativeDepositRecovery(record.id)
                .then((status) => {
                  if (status === 'pending')
                    Toast.message({
                      title: intl.formatMessage({
                        id: ETranslations.global_pending,
                      }),
                    });
                  if (status === 'mismatch')
                    Toast.error({
                      title: intl.formatMessage({
                        id: ETranslations.global_an_error_occurred,
                      }),
                    });
                })
                .catch(() =>
                  Toast.error({
                    title: intl.formatMessage({
                      id: ETranslations.global_an_error_occurred,
                    }),
                  }),
                );
            },
          };
        } else if (done) {
          action = {
            primary: intl.formatMessage({
              id: ETranslations.global_done,
            }),
            onPrimaryPress: () => {
              if (record.status === 'completed')
                etherFiDepositRecovery.dismissCompleted(record.id);
              else etherFiDepositRecovery.dismissFailedWrap(record.id);
            },
          };
        }
        return (
          <Alert
            key={record.renderKey}
            type={record.status === 'failed' ? 'warning' : 'info'}
            title={`${phase} · ${title} · ${record.amount} ETH`}
            action={action}
          />
        );
      })}
    </YStack>
  );
}
