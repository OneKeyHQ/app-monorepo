import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import { WalletBackupActions } from '@onekeyhq/kit/src/components/WalletBackup';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function HdWalletBackupButton({
  wallet,
  onClose,
}: {
  wallet: IDBWallet | undefined;
  onClose: () => void;
}) {
  const intl = useIntl();
  return (
    <WalletBackupActions
      wallet={wallet}
      actionListProps={{
        offset: {
          mainAxis: 0,
          crossAxis: 18,
        },
      }}
      onClose={onClose}
    >
      <ActionList.Item
        testID="AccountSelector-WalletOption-Backup"
        icon="Shield2CheckOutline"
        label={intl.formatMessage({ id: ETranslations.global_backup })}
        // onClose={onClose}
        onClose={() => {}}
        onPress={() => {
          // void handleBackupPhrase();
        }}
      />
    </WalletBackupActions>
  );
}
