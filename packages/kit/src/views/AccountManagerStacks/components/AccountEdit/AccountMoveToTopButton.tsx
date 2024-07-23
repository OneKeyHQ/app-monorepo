import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function AccountMoveToTopButton({
  indexedAccount,
  wallet,
  onClose,
}: {
  indexedAccount?: IDBIndexedAccount;
  wallet?: IDBWallet;
  onClose?: () => void;
}) {
  const intl = useIntl();
  return (
    <ActionList.Item
      icon="AlignTopOutline"
      label={intl.formatMessage({ id: ETranslations.market_move_to_top })}
      onClose={onClose}
      onPress={async () => {
        if (!wallet || !indexedAccount) {
          return;
        }
        const { accounts: indexedAccountList } =
          await backgroundApiProxy.serviceAccount.getIndexedAccountsOfWallet({
            walletId: wallet?.id,
          });
        await backgroundApiProxy.serviceAccount.insertIndexedAccountOrder({
          targetIndexedAccountId: indexedAccount?.id,
          startIndexedAccountId: undefined,
          endIndexedAccountId: indexedAccountList?.[0]?.id,
          emitEvent: true,
        });
      }}
    />
  );
}
