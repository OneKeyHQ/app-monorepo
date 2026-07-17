import { Button, Page, SizableText, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalFiatCryptoRoutes } from '@onekeyhq/shared/src/routes/fiatCrypto';
import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';

// Dev-only launcher for previewing the Onramper Headless buy page on the
// Simulator with the mock client. Not part of any production flow.
const PREVIEW_TOKEN: IFiatCryptoToken = {
  address: '',
  name: 'Ethereum',
  symbol: 'ETH',
  networkId: 'evm--1',
  icon: '',
  headlessSupported: true,
};

function HeadlessBuyGallery() {
  const navigation = useAppNavigation();
  return (
    <Page>
      <Page.Header title="Headless Buy (mock)" />
      <Page.Body>
        <YStack p="$5" gap="$4">
          <SizableText size="$bodyMd" color="$textSubdued">
            Opens the native Headless buy page backed by the mock client. Type
            an amount to see the debounced quote + button swap; enter 1 to force
            the web-fallback (S5) and 2 to force a retryable error (S4).
          </SizableText>
          <Button
            testID="open-headless-buy"
            variant="primary"
            size="large"
            onPress={() => {
              navigation.pushModal(EModalRoutes.FiatCryptoModal, {
                screen: EModalFiatCryptoRoutes.HeadlessBuy,
                params: {
                  networkId: PREVIEW_TOKEN.networkId,
                  tokenAddress: PREVIEW_TOKEN.address,
                  type: 'buy',
                  token: PREVIEW_TOKEN,
                },
              });
            }}
          >
            Open Headless Buy page
          </Button>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default HeadlessBuyGallery;
