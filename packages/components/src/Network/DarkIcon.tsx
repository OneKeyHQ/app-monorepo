import type { FC } from 'react';

import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import Icon from '../Icon';
import { TokenIcon } from '../Token';

import type { ICON_NAMES } from '../Icon';

export const NetworkDarkIconNameMap: Record<string, ICON_NAMES> = {
  [OnekeyNetwork.ada]: 'CardanoIllus',
  [OnekeyNetwork.algo]: 'AlgorandIllus',
  [OnekeyNetwork.apt]: 'AptosIllus',
  [OnekeyNetwork.bch]: 'BitcoinCashIllus',
  [OnekeyNetwork.btc]: 'BitcoinIllus',
  [OnekeyNetwork.cfx]: 'ConfluxEspaceIllus',
  [OnekeyNetwork.akash]: 'AkashIllus',
  [OnekeyNetwork.cosmoshub]: 'CosmosIllus',
  [OnekeyNetwork.cryptoorgchain]: 'CryptoOrgIllus',
  [OnekeyNetwork.fetch]: 'FetchAiIllus',
  [OnekeyNetwork.juno]: 'JunoIllus',
  [OnekeyNetwork.osmosis]: 'OsmosisIllus',
  [OnekeyNetwork.terra]: 'TerraIllus',
  [OnekeyNetwork.secretnetwork]: 'SecretNetworkIllus',
  [OnekeyNetwork.doge]: 'DogecoinIllus',
  [OnekeyNetwork.astar]: 'AstarIllus',
  [OnekeyNetwork.ksm]: 'KusamaIllus',
  [OnekeyNetwork.dot]: 'PolkadotIllus',
  [OnekeyNetwork.eth]: 'EthereumIllus',
  [OnekeyNetwork.optimism]: 'OptimismIllus',
  [OnekeyNetwork.xdai]: 'GnosisChainIllus',
  [OnekeyNetwork.ethw]: 'EthereumpowIllus',
  [OnekeyNetwork.cfxespace]: 'ConfluxEspaceIllus',
  [OnekeyNetwork.heco]: 'HuobiEcoChainIllus',
  [OnekeyNetwork.aurora]: 'AuroraIllus',
  [OnekeyNetwork.polygon]: 'PolygonIllus',
  [OnekeyNetwork.cronos]: 'CronosIllus',
  [OnekeyNetwork.fantom]: 'FantomIllus',
  [OnekeyNetwork.boba]: 'BobaNetworkIllus',
  [OnekeyNetwork.fevm]: 'FilecoinIllus',
  [OnekeyNetwork.zksyncera]: 'ZksyncEraMainnetIllus',
  [OnekeyNetwork.arbitrum]: 'ArbitrumIllus',
  [OnekeyNetwork.celo]: 'CeloIllus',
  [OnekeyNetwork.avalanche]: 'AvalancheIllus',
  [OnekeyNetwork.etf]: 'EthereumFairIllus',
  [OnekeyNetwork.bsc]: 'BnbSmartChainIllus',
  [OnekeyNetwork.etc]: 'EthereumClassicIllus',
  [OnekeyNetwork.okt]: 'OkxChainIllus',
  [OnekeyNetwork.mvm]: 'MixinVirtualMachineIllus',
  [OnekeyNetwork.fil]: 'FilecoinIllus',
  [OnekeyNetwork.kaspa]: 'KaspaIllus',
  [OnekeyNetwork.ltc]: 'LitecoinIllus',
  [OnekeyNetwork.near]: 'NearIllus',
  [OnekeyNetwork.sol]: 'SolanaIllus',
  [OnekeyNetwork.stc]: 'StarcoinIllus',
  [OnekeyNetwork.sui]: 'SuiIllus',
  [OnekeyNetwork.trx]: 'TronIllus',
  [OnekeyNetwork.xmr]: 'MoneroIllus',
  [OnekeyNetwork.xrp]: 'RippleIllus',
  [OnekeyNetwork.lightning]: 'LightningNetworkIllus',
  [OnekeyNetwork.nexa]: 'NexaIllus',
  more: 'MoreIllus',
};

export const NetworkDarkIcon: FC<{
  networkId: string;
  fallback?: string;
  size?: number;
}> = ({ networkId, fallback, size = 4 }) => {
  const iconName = NetworkDarkIconNameMap[networkId];
  if (iconName) {
    return <Icon size={4 * size} name={iconName} />;
  }
  return (
    <TokenIcon
      size={size}
      token={{
        name: fallback,
      }}
    />
  );
};
