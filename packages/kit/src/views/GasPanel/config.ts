import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

export const supportedNetworks = [
  OnekeyNetwork.btc,
  OnekeyNetwork.eth,
  OnekeyNetwork.polygon,
];

export const supportedNetworksSettings = {
  [OnekeyNetwork.btc]: {
    supportOverview: false,
    EIP1559Enabled: false,
  },
  [OnekeyNetwork.eth]: {
    supportOverview: true,
    EIP1559Enabled: true,
  },
  [OnekeyNetwork.polygon]: {
    supportOverview: true,
    EIP1559Enabled: true,
  },
};

export const networkPendingTransactionThresholds = {
  [OnekeyNetwork.eth]: {
    'low': 0,
    'stable': 100,
    'busy': 200,
  },
  [OnekeyNetwork.polygon]: {
    'low': 0,
    'stable': 200,
    'busy': 300,
  },
};

export const btcMockLimit = '340';
