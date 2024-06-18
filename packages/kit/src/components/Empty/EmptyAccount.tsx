import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import { AccountSelectorCreateAddressButton } from '../AccountSelector/AccountSelectorCreateAddressButton';

type IProps = {
  name: string;
  chain: string;
  type: string;
};

const num = 0;

function EmptyAccount(props: IProps) {
  const { name, chain, type } = props;
  const intl = useIntl();
  const { selectedAccount } = useSelectedAccount({ num });
  const { activeAccount } = useActiveAccount({ num });
  const showDerivationType = activeAccount.deriveInfoItems.length > 1;

  return (
    <Empty
      testID="Wallet-No-Address-Empty"
      title={intl.formatMessage({ id: ETranslations.wallet_no_address })}
      description={intl.formatMessage(
        {
          id: ETranslations.wallet_no_address_desc,
        },
        {
          name,
          chain: `${chain} ${showDerivationType && type ? `(${type})` : ''}`,
        },
      )}
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
