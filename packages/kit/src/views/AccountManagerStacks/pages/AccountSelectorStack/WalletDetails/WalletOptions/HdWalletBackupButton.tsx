import { useIntl } from 'react-intl';

import { WalletBackupActions } from '@onekeyhq/kit/src/components/WalletBackup';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { WalletOptionItem } from './WalletOptionItem';

export function HdWalletBackupButton({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  const intl = useIntl();
  return (
    <WalletBackupActions wallet={wallet}>
      <WalletOptionItem
        testID="AccountSelector-WalletOption-Backup"
        icon="Shield2CheckOutline"
        label={intl.formatMessage({ id: ETranslations.global_backup })}
      />
    </WalletBackupActions>
  );
}
