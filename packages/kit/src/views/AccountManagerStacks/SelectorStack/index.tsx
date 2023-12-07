import { useCallback, useState } from 'react';

import { Page } from '@onekeyhq/components';

import { MockOthersWallet, MockPrimaryWallets } from '../mockWallets';
import { type IAccountProps, type IWalletProps } from '../types';

import { WalletDetails } from './WalletDetails';
import { WalletList } from './WalletList';

const mergedWallets = [...MockPrimaryWallets, MockOthersWallet];

export function SelectorStack() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState(
    MockPrimaryWallets[0].id,
  );
  const [selectedAccountId, setSelectedAccountId] = useState(
    MockPrimaryWallets[0].accounts[0].data[0].id,
  );

  const handleWalletListItemPress = useCallback(
    (walletId: IWalletProps['id']) => {
      setSelectedWalletId(walletId);
    },
    [setSelectedWalletId],
  );

  const handleAccountPress = useCallback(
    (accountId: IAccountProps['id']) => {
      setSelectedAccountId(accountId);
    },
    [setSelectedAccountId],
  );

  const activeWallet = mergedWallets.find(
    (wallet) => wallet.id === selectedWalletId,
  );

  return (
    <Page>
      <Page.Header headerShown={false} />
      <Page.Body flexDirection="row">
        <WalletList
          primaryWallets={MockPrimaryWallets}
          othersWallet={MockOthersWallet}
          selectedWalletId={selectedWalletId}
          onWalletPress={handleWalletListItemPress}
        />
        <WalletDetails
          wallet={activeWallet}
          selectedAccountId={selectedAccountId}
          onAccountPress={handleAccountPress}
          onEditButtonPress={() => setIsEditMode(!isEditMode)}
          editMode={isEditMode}
        />
      </Page.Body>
    </Page>
  );
}
