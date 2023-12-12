import { Button, Text } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useAccountSelectorActions,
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

export function AccountSelectorActiveAccount({ num }: { num: number }) {
  const { serviceAccount } = backgroundApiProxy;
  const {
    activeAccount: { wallet, network, account },
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();

  const { selectedAccount } = useSelectedAccount({ num });

  return (
    <>
      <Text>
        {'>>>>>>'} {wallet?.name} -- {network?.name} --{' '}
        {selectedAccount?.deriveType}/{selectedAccount.indexedAccountId} --{' '}
        {account?.name}
      </Text>
      {account?.address ? (
        <>
          <Text>
            {accountUtils.shortenAddress({
              address: account?.address || '',
            })}
          </Text>
          <Text>{account?.id}</Text>
          <Text>{account?.path}</Text>
        </>
      ) : (
        <Button
          onPress={async () => {
            if (!selectedAccount) {
              return;
            }
            const c = await serviceAccount.addHDAccounts({
              walletId: selectedAccount?.walletId,
              networkId: selectedAccount?.networkId,
              indexedAccountId: selectedAccount?.indexedAccountId,
              deriveType: selectedAccount?.deriveType,
            });
            console.log(c);
            // await refreshCurrentAccount();
            actions.current.refresh({ num });
          }}
        >
          暂无账户，点击创建
        </Button>
      )}
    </>
  );
}
