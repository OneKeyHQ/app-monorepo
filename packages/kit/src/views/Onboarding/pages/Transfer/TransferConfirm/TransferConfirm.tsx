import { useIntl } from 'react-intl';

import { Page, SizableText, Stack, Toast } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import WalletList from '../components/WalletList';

import type { IWalletItem } from '../components/WalletItem';

export function TransferConfirm() {
  const intl = useIntl();
  const appNavigation = useAppNavigation();

  const selectedWallet: IWalletItem = {
    id: '1',
    name: 'Wallet 1',
    accountCount: 3,
    image: 'https://example.com/wallet1.png',
    selected: true,
  };

  const handleWalletListSelectChange = (selectedWallets: IWalletItem[]) => {
    console.log('Confirmed wallet:', selectedWallets[0]);
  };

  return (
    <Page>
      <Page.Header title="TransferConfirm" />
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
          // Handle transfer confirmation logic here
          console.log('Transfer confirmed for wallet:', selectedWallet);

          // Show success toast
          Toast.success({
            title: 'Success',
            message: 'Transfer successful!',
          });

          // Navigate away or close the page
          appNavigation.pop();
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_transfer,
        })}
      />
    </Page>
  );
}

export default TransferConfirm;
