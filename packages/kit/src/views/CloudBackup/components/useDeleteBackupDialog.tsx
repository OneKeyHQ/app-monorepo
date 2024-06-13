import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function DeleteBackupDialogFooter({
  filename,
  callback,
}: {
  filename: string;
  callback?: () => void;
}) {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  return (
    <Dialog.Footer
      confirmButtonProps={{
        loading,
      }}
      tone="destructive"
      onConfirmText={intl.formatMessage({ id: ETranslations.global_delete })}
      onConfirm={async () => {
        try {
          setLoading(true);
          await backgroundApiProxy.serviceCloudBackup.removeBackup(filename);
          callback?.();
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.backup_backup_deleted,
            }),
          });
        } finally {
          setLoading(false);
        }
      }}
    />
  );
}

export function useDeleteBackupDialog() {
  const intl = useIntl();
  const show = useCallback(
    (filename: string) =>
      new Promise<void>((resolve) => {
        Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.backup_delete_this_backup,
          }),
          icon: 'DeleteOutline',
          description: intl.formatMessage({
            id: ETranslations.backup_file_permanently_deleted,
          }),
          tone: 'destructive',
          renderContent: (
            <DeleteBackupDialogFooter filename={filename} callback={resolve} />
          ),
        });
      }),
    [intl],
  );
  return useMemo(() => ({ show }), [show]);
}
