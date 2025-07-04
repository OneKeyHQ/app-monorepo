import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, SizableText, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes/onboarding';

import WalletList from '../components/WalletList';

import type { IWalletItem } from '../components/WalletItem';

export function TransferPreview() {
  const intl = useIntl();
  const appNavigation = useAppNavigation();

  // Mock data - replace with actual data in your implementation
  const initialWallets: IWalletItem[] = [
    {
      id: '1',
      name: 'Wallet 1',
      accountCount: 3,
      image: 'https://example.com/wallet1.png',
      selected: false,
    },
    {
      id: '2',
      name: 'Wallet 2',
      accountCount: 5,
      image: 'https://example.com/wallet2.png',
      selected: false,
    },
  ];

  const [wallets, setWallets] = useState<IWalletItem[]>(initialWallets);

  const handleWalletListSelectChange = (selectedWallets: IWalletItem[]) => {
    console.log('Selected wallets:', selectedWallets);
    const updatedWallets = wallets.map((wallet) => ({
      ...wallet,
      selected: selectedWallets.some((selected) => selected.id === wallet.id),
    }));
    setWallets(updatedWallets);

    if (selectedWallets.length === 1) {
      // TODO: navigate to TransferConfirm page
    }
  };

  return (
    <Page>
      <Page.Header title="TransferPreview" />
      <Page.Body>
        <Stack p="$5" gap="$5">
          <SizableText size="$headingXl">
            {intl.formatMessage({
              id: ETranslations.global_select_wallet,
            })}
          </SizableText>
          <WalletList
            wallets={wallets}
            onWalletListSelectChange={handleWalletListSelectChange}
            multiSelect
          />
        </Stack>
      </Page.Body>
      <Page.Footer
        onConfirm={() => {
          appNavigation.navigate(EOnboardingPages.TransferConfirm);
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_transfer,
        })}
      />
    </Page>
  );
}

export default TransferPreview;
