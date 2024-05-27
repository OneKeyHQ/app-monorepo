import { useState } from 'react';

import { Empty } from '@onekeyhq/components';

import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import { AccountSelectorCreateAddressButton } from '../AccountSelector/AccountSelectorCreateAddressButton';
import { useAccountSelectorCreateAddress } from '../AccountSelector/hooks/useAccountSelectorCreateAddress';

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
  const { createAddress } = useAccountSelectorCreateAddress();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Empty
      testID="Wallet-No-Address-Empty"
      title="No Address"
      description={`${name} does not have a ${chain} (${type}) address yet. Please create one to continue`}
      button={
        <AccountSelectorCreateAddressButton
          num={num}
          selectAfterCreate
          account={selectedAccount}
          buttonRender={Empty.Button}
        />
      }
    />
  );
}

export { EmptyAccount };
