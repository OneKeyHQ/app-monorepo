import { Empty } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

type IProps = {
  name: string;
  chain: string;
  type: string;
};

const num = 0;

function EmptyAccount(props: IProps) {
  const { name, chain, type } = props;
  const actions = useAccountSelectorActions();
  const { selectedAccount } = useSelectedAccount({ num });

  return (
    <Empty
      testID="Wallet-No-Address-Empty"
      title="No Address"
      description={`${name} does not have a ${chain} (${type}) address yet. Please create one to continue`}
      buttonProps={{
        children: 'Create Address',
        onPress: async () => {
          if (!selectedAccount) {
            return;
          }
          await backgroundApiProxy.serviceAccount.addHDOrHWAccounts({
            walletId: selectedAccount?.walletId,
            networkId: selectedAccount?.networkId,
            indexedAccountId: selectedAccount?.indexedAccountId,
            deriveType: selectedAccount?.deriveType,
          });
          actions.current.refresh({ num });
        },
      }}
    />
  );
}

export { EmptyAccount };
