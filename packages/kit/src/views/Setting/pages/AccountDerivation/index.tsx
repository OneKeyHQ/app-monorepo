import type { FC } from 'react';
import { useRef, useState } from 'react';

import type { ISelectItem } from '@onekeyhq/components';
import { Page, Select, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

type IAccountDerivationListItemProps = {
  title: string;
  icon: string;
  value?: string;
  onChange?: ((value: any) => void) | undefined;
  items?: ISelectItem[];
};

const AccountDerivationListItem: FC<IAccountDerivationListItemProps> = ({
  value,
  onChange,
  title,
  icon,
  items,
}) => (
  <Select
    renderTrigger={({ label }) => (
      <ListItem title={title} avatarProps={{ src: icon }}>
        <XStack>
          <SizableText mr="$3">{label}</SizableText>
          <ListItem.DrillIn name="ChevronDownSmallSolid" />
        </XStack>
      </ListItem>
    )}
    placement="bottom-end"
    items={items}
    value={value}
    onChange={onChange}
    title="Derivation Path"
  />
);

const BitcoinAccountDerivation = () => {
  const ref = useRef<ISelectItem[]>([
    {
      label: 'Taproot',
      value: 'Taproot',
      // eslint-disable-next-line spellcheck/spell-checker
      description: `P2TR (m/86'/0'/0'), Starts with 'bc1p'`,
    },
    {
      label: 'Nested SegWit',
      value: 'Nested SegWit',
      description: `P2WPKH (m/49'/0'/0'), Starts with '3'`,
    },
    {
      label: 'Native SegWit',
      value: 'Native SegWit',
      // eslint-disable-next-line spellcheck/spell-checker
      description: `P2SH-P2WPKH (m/84'/0'/0'), Starts with 'bc1q'`,
    },
    {
      label: 'Legacy',
      value: 'Legacy',
      description: `P2PKH (m/44'/0'/0'), Starts with '1'`,
    },
  ]);
  const [val, setVal] = useState(ref.current[0].value);
  return (
    <AccountDerivationListItem
      title="Bitcoin"
      icon="https://onekey-asset.com/assets/btc/btc.png"
      value={val}
      onChange={setVal}
      items={ref.current}
    />
  );
};

const EvmAccountDerivation = () => {
  const ref = useRef<ISelectItem[]>([
    {
      label: 'BIP44',
      value: 'BIP44',
      // eslint-disable-next-line spellcheck/spell-checker
      description: `OneKey, MetaMask, Trezor, imToken, m/44'/60'/0'/0/*`,
    },
    {
      label: 'Ledger Live',
      value: 'Ledger Live',
      description: `m/44'/60'/*'/0/0`,
    },
  ]);
  const [val, setVal] = useState(ref.current[0].value);
  return (
    <AccountDerivationListItem
      title="EVM"
      icon="https://onekey-asset.com/assets/eth/eth.png"
      value={val}
      onChange={setVal}
      items={ref.current}
    />
  );
};

const SolanaAccountDerivation = () => {
  const ref = useRef<ISelectItem[]>([
    {
      label: 'BIP44',
      value: 'BIP44',
      // eslint-disable-next-line spellcheck/spell-checker
      description: `OneKey, Phantom, Sollet, m/44'/501'/*'/0'`,
    },
    {
      label: 'Ledger Live',
      value: 'Ledger Live',
      description: `Ledger Live, Solflare, m/44'/501'/*'`,
    },
  ]);
  const [val, setVal] = useState(ref.current[0].value);
  return (
    <AccountDerivationListItem
      title="Solana"
      icon="https://onekey-asset.com/assets/sol/sol.png"
      value={val}
      onChange={setVal}
      items={ref.current}
    />
  );
};

const LiteCoinAccountDerivation = () => {
  const ref = useRef<ISelectItem[]>([
    {
      label: 'Nested SegWit',
      value: 'Nested SegWit',
      // eslint-disable-next-line spellcheck/spell-checker
      description: `Starts with “M”. BIP49, P2SH-P2WPKH, Base58.`,
    },
    {
      label: 'Native SegWit',
      value: 'Native SegWit',
      description: `Starts with with “ltc1”. BIP84, P2WPKH, Bech32.`,
    },
    {
      label: 'Legacy',
      value: 'Legacy',
      description: `Starts with “L”. BIP44, P2PKH, Base58.`,
    },
  ]);
  const [val, setVal] = useState(ref.current[0].value);
  return (
    <AccountDerivationListItem
      title="Lite Coin"
      icon="https://common.onekey-asset.com/chain/ltc.png"
      value={val}
      onChange={setVal}
      items={ref.current}
    />
  );
};

const EthereumClassicAccountDerivation = () => {
  const ref = useRef<ISelectItem[]>([
    {
      label: 'BIP44',
      value: 'BIP44',
      // eslint-disable-next-line spellcheck/spell-checker
      description: `OneKey, MetaMask, Trezor, ImToken, m/44'/60'/0'/0/*`,
    },
    {
      label: `BIP44  (CoinType 61')`,
      value: `BIP44  (CoinType 61')`,
      description: `m/44'/61'/*'/0/0`,
    },
    {
      label: 'Ledger Live',
      value: 'Ledger Live',
      description: `m/44'/60'/*'/0/0`,
    },
  ]);
  const [val, setVal] = useState(ref.current[0].value);
  return (
    <AccountDerivationListItem
      title="Ethereum Classic"
      icon="https://onekey-asset.com/assets/etc/etc.png"
      value={val}
      onChange={setVal}
      items={ref.current}
    />
  );
};

const AccountDerivation = () => (
  <Page>
    <Stack px="$5" py="$3">
      <SizableText size="$bodyLg">
        If you don't see the accounts you expect, try switching the derivation
        path.
      </SizableText>
    </Stack>
    <Stack>
      <BitcoinAccountDerivation />
      <EvmAccountDerivation />
      <SolanaAccountDerivation />
      <LiteCoinAccountDerivation />
      <EthereumClassicAccountDerivation />
    </Stack>
  </Page>
);

export default AccountDerivation;
