import { ListItem, Page, Stack, Text } from '@onekeyhq/components';

const AccountDerivation = () => (
  <Page>
    <Stack px="$5" pt="$3">
      <Text variant="$headingSm">ETHEREUM & EVM CHAINS</Text>
    </Stack>
    <Stack>
      <ListItem
        title="BIP44"
        subtitle="OneKey, MetaMask, Trezor, imToken, m/44’/60’/0’/0/*"
      />
      <ListItem title="Ledger Live" subtitle="m/44’/60’/*’/0/0" />
    </Stack>
  </Page>
);

export default AccountDerivation;
