import AptosMartianLogo from '@onekeyhq/kit/assets/walletLogo/aptos_martian.png';
import AptosPetraLogo from '@onekeyhq/kit/assets/walletLogo/aptos_petra.png';
import CardanoNamiLogo from '@onekeyhq/kit/assets/walletLogo/cardano_nami.png';
import ConflusFluentLogo from '@onekeyhq/kit/assets/walletLogo/conflux_fluent_wallet.png';
import CosmosKeplrLogo from '@onekeyhq/kit/assets/walletLogo/cosmos_keplr.png';
import MetamaskLogo from '@onekeyhq/kit/assets/walletLogo/evm_metamask.png';
import SolanaPhantomLogo from '@onekeyhq/kit/assets/walletLogo/solana_phantom.png';
import StarcoinStarmaskLogo from '@onekeyhq/kit/assets/walletLogo/starcoin_starmask.png';
import SuiWalletLogo from '@onekeyhq/kit/assets/walletLogo/sui_sui_wallet.png';
import TronLinkLogo from '@onekeyhq/kit/assets/walletLogo/tron_tronlink.png';

import type { WalletSwitchItem } from '../../../../store/reducers/settings';

export const CWalletSwitchDefaultConfig: Record<string, WalletSwitchItem> = {
  'EVM-Metamask': {
    logo: MetamaskLogo,
    title: 'Metamask',
    propertyKeys: ['ethereum'],
    enable: true,
  },
  'COSMOS-Keplr': {
    logo: CosmosKeplrLogo,
    title: 'Keplr',
    propertyKeys: [
      'keplr',
      'getOfflineSigner',
      'getOfflineSignerOnlyAmino',
      'getOfflineSignerAuto',
    ],
    enable: true,
  },
  'APTOS-Petra': {
    logo: AptosPetraLogo,
    title: 'Petra',
    propertyKeys: ['aptos'],
    enable: true,
  },
  'APTOS-Martian': {
    logo: AptosMartianLogo,
    title: 'Martian',
    propertyKeys: ['martian'],
    enable: false,
  },
  'SUI-Sui Wallet': {
    logo: SuiWalletLogo,
    title: 'Sui Wallet',
    propertyKeys: ['suiWallet'],
    enable: true,
  },
  'SOLANA-Phantom': {
    logo: SolanaPhantomLogo,
    title: 'Phantom',
    propertyKeys: ['solana', 'phantom'],
    enable: true,
  },
  'TRON-TronLink': {
    logo: TronLinkLogo,
    title: 'TronLink',
    propertyKeys: ['tronLink', 'tronWeb', 'sunWeb'],
    enable: true,
  },
  'CARDAND-Nami': {
    logo: CardanoNamiLogo,
    title: 'Nami',
    propertyKeys: ['cardano'],
    enable: true,
  },
  'STARCOIN-StarMask': {
    logo: StarcoinStarmaskLogo,
    title: 'StarMask',
    propertyKeys: ['starcoin'],
    enable: true,
  },
  'CONFLUX-Fluent': {
    logo: ConflusFluentLogo,
    title: 'Fluent',
    propertyKeys: ['conflux'],
    enable: true,
  },
};
