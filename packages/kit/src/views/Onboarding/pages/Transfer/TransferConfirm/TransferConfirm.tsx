import { useIntl } from 'react-intl';

import { Page, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import WalletList from '../components/WalletList';

import type { IWalletItem } from '../components/WalletList';

export function TransferConfirm() {
  const intl = useIntl();

  const selectedWallet: IWalletItem = {
    id: '1',
    name: 'Wallet 1',
    balance: '1.23 ETH',
    image: 'https://example.com/wallet1.png',
    selected: true,
  };

  const handleWalletListSelectChange = (selectedWallets: IWalletItem[]) => {
    console.log('Confirmed wallet:', selectedWallets[0]);
  };

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_confirm,
        })}
      />
      <Page.Body>
        <Stack p="$5" gap="$5">
          <Stack gap="$4">
            <SizableText size="$headingXl">
              {intl.formatMessage({
                id: ETranslations.global_confirm,
              })}
            </SizableText>
            <WalletList
              wallets={[selectedWallet]}
              onWalletListSelectChange={handleWalletListSelectChange}
            />
          </Stack>
        </Stack>
      </Page.Body>

      <Page.Footer
        onConfirm={() => {
          // Handle transfer confirmation
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_transfer,
        })}
      />
    </Page>
  );
}

export default TransferConfirm;
