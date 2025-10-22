import { useMemo } from 'react';

import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function useAccountSelectorAvatarNetwork({
  linkedNetworkId,
  linkNetwork,
  selectedAccount,
  isOthersUniversal,
  account,
  indexedAccount,
}: {
  linkedNetworkId?: string;
  linkNetwork: boolean | undefined;
  selectedAccount?: IAccountSelectorSelectedAccount;
  isOthersUniversal: boolean;
  account?: IDBAccount;
  indexedAccount?: IDBIndexedAccount;
}) {
  const avatarNetworkId: string | undefined = useMemo(() => {
    let _avatarNetworkId: string | undefined;
    const accountLinkedNetworkId =
      linkedNetworkId || selectedAccount?.networkId;
    if (isOthersUniversal && account) {
      _avatarNetworkId = accountUtils.getAccountCompatibleNetwork({
        account,
        networkId: linkNetwork
          ? accountLinkedNetworkId
          : account.createAtNetwork,
      });
    }
    if (!_avatarNetworkId && indexedAccount && linkNetwork) {
      _avatarNetworkId = accountLinkedNetworkId;
    }
    return _avatarNetworkId;
  }, [
    account,
    indexedAccount,
    isOthersUniversal,
    linkNetwork,
    linkedNetworkId,
    selectedAccount?.networkId,
  ]);

  return { avatarNetworkId };
}
