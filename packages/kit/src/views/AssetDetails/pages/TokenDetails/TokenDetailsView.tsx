import { memo, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Stack } from '@onekeyhq/components';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import TokenDetailsHeader from './TokenDetailsHeader';
import TokenDetailsHistory from './TokenDetailsHistory';

import type { IProps } from '.';

const num = 0;

function TokenDetailsViews(props: IProps) {
  const { accountId, networkId, walletId, deriveType, indexedAccountId } =
    props;

  const intl = useIntl();
  const [overviewInit, setOverviewInit] = useState(false);
  const [historyInit, setHistoryInit] = useState(false);

  const [currentAccountId, setCurrentAccountId] = useState(accountId);

  const handleCreateAccount = useCallback(
    async (params: { accounts: IDBAccount[] } | undefined) => {
      if (params && params.accounts && params.accounts.length > 0) {
        setCurrentAccountId(params.accounts[0].id);
      }
    },
    [],
  );

  if (!currentAccountId) {
    return (
      <Stack height="100%" flex={1} justifyContent="center">
        <Empty
          testID="TokenDetailsViews__Wallet-No-Address-Empty"
          title={intl.formatMessage({ id: ETranslations.wallet_no_address })}
          description={intl.formatMessage({
            id: ETranslations.wallet_no_address_desc,
          })}
          button={
            <AccountSelectorCreateAddressButton
              num={num}
              selectAfterCreate
              account={{
                walletId,
                networkId,
                indexedAccountId,
                deriveType,
              }}
              buttonRender={Empty.Button}
              onCreateDone={handleCreateAccount}
            />
          }
        />
      </Stack>
    );
  }
  return (
    <>
      <TokenDetailsHeader
        {...props}
        accountId={currentAccountId}
        setOverviewInit={setOverviewInit}
        overviewInit={overviewInit}
        historyInit={historyInit}
      />
      <TokenDetailsHistory
        {...props}
        accountId={currentAccountId}
        setHistoryInit={setHistoryInit}
        historyInit={historyInit}
      />
    </>
  );
}

export default memo(TokenDetailsViews);
