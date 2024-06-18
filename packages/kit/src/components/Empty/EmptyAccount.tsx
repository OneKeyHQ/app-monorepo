import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
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
  const { activeAccount } = useActiveAccount({ num });
  let description: string | undefined;
  if (activeAccount?.canCreateAddress) {
    description = intl.formatMessage(
      {
        id: ETranslations.wallet_no_address_desc,
      },
      {
        name,
        chain: `${chain} ${type ? `(${type})` : ''}`,
      },
    );
  } else if (activeAccount?.isNetworkNotMatched) {
    description = intl.formatMessage({
      id: ETranslations.global_network_not_matched,
    });
  }

  return (
    <Empty
      testID="Wallet-No-Address-Empty"
      title={intl.formatMessage({ id: ETranslations.wallet_no_address })}
      description={description}
      button={
        activeAccount?.canCreateAddress ? (
          <AccountSelectorCreateAddressButton
            num={num}
            selectAfterCreate
            account={{
              walletId: activeAccount?.wallet?.id,
              networkId: activeAccount?.network?.id,
              indexedAccountId: activeAccount?.indexedAccount?.id,
              deriveType: activeAccount?.deriveType,
            }}
            buttonRender={Empty.Button}
          />
        ) : null
      }
    />
  );
}

export { EmptyAccount };
