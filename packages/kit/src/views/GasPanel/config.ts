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

export const btcMockInputs = [
  {
    'txId': '954cc2f429ba0439ed255410e175eabad65de8426a86ea0b27dd2031e5712651',
    'vout': 1,
    'value': 268984,
    'address': 'bc1pqwuk8d57rvnw2e2xmxn6glhsl0hfz4e6rjzmazucafumnwpmss7qg4cymh',
    'path': "m/86'/0'/0'/0/0",
  },
  {
    'txId': 'cf9daad4a1765b2846e26689291d5a67de14185d16fc57cfe3b3651f5c061484',
    'vout': 0,
    'value': 546,
    'address': 'bc1pqwuk8d57rvnw2e2xmxn6glhsl0hfz4e6rjzmazucafumnwpmss7qg4cymh',
    'path': "m/86'/0'/0'/0/0",
  },
  {
    'txId': '520d8098abd258fcd35d8c6a6564000a4f44ff5998653805d5440849c49000d2',
    'vout': 0,
    'value': 546,
    'address': 'bc1pqwuk8d57rvnw2e2xmxn6glhsl0hfz4e6rjzmazucafumnwpmss7qg4cymh',
    'path': "m/86'/0'/0'/0/0",
  },
  {
    'txId': '8b9201de6bfec423619231d05c7d829e30644364044e3007df06cd3660efc5a9',
    'vout': 0,
    'value': 546,
    'address': 'bc1pqwuk8d57rvnw2e2xmxn6glhsl0hfz4e6rjzmazucafumnwpmss7qg4cymh',
    'path': "m/86'/0'/0'/0/0",
  },
  {
    'txId': 'a1f69861db3586229bc0d3d98ddd1f8fdd95402ccac3865798980cfd0c654fda',
    'vout': 0,
    'value': 546,
    'address': 'bc1pqwuk8d57rvnw2e2xmxn6glhsl0hfz4e6rjzmazucafumnwpmss7qg4cymh',
    'path': "m/86'/0'/0'/0/0",
  },
  {
    'txId': '2d31982c5bb9cb39b34edbc78918cd274571658979ea78ef16a9f91ddc278aa5',
    'vout': 0,
    'value': 546,
    'address': 'bc1pqwuk8d57rvnw2e2xmxn6glhsl0hfz4e6rjzmazucafumnwpmss7qg4cymh',
    'path': "m/86'/0'/0'/0/0",
  },
];

export const btcMockOutputs = [
  {
    'address': '37i5rvSfAinZY31sRUqywKsUCDSdo2nrMQ',
    'value': 100000,
  },
];
