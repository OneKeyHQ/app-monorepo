import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function AccountMoveToTopButton({
  indexedAccount,
  firstIndexedAccount,
  onClose,
}: {
  indexedAccount?: IDBIndexedAccount;
  firstIndexedAccount?: IDBIndexedAccount;
  onClose?: () => void;
}) {
  const intl = useIntl();
  if (firstIndexedAccount?.id === indexedAccount?.id) {
    return null;
  }
  return (
    <ActionList.Item
      icon="AlignTopOutline"
      label={intl.formatMessage({ id: ETranslations.market_move_to_top })}
      onClose={onClose}
      onPress={async () => {
        if (!indexedAccount) {
          return;
        }
        await backgroundApiProxy.serviceAccount.insertIndexedAccountOrder({
          targetIndexedAccountId: indexedAccount?.id,
          startIndexedAccountId: undefined,
          endIndexedAccountId: firstIndexedAccount?.id,
          emitEvent: true,
        });
      }}
    />
  );
}
