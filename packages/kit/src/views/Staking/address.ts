import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import {
  MainnetKeleContractAddress,
  MainnetLidoContractAddress,
  MainnetLidoWithdrawalERC721,
  MainnetMaticContractAddress,
  MainnetStMaticContractAddress,
  TestnetKeleContractAddress,
  TestnetLidoContractAddress,
  TestnetLidoWithdrawalERC721,
  TestnetMaticContractAddress,
  TestnetStMaticContractAddress,
} from './config';

export const getMaticContractAdderess = (networkId: string) => {
  if (networkId === OnekeyNetwork.eth) {
    return MainnetMaticContractAddress;
  }
  if (networkId === OnekeyNetwork.goerli) {
    return TestnetMaticContractAddress;
  }
  throw new Error('Not supported network');
};

export const getStMaticContractAdderess = (networkId: string) => {
  if (networkId === OnekeyNetwork.eth) {
    return MainnetStMaticContractAddress;
  }
  if (networkId === OnekeyNetwork.goerli) {
    return TestnetStMaticContractAddress;
  }
  throw new Error('Not supported network');
};

export const getLidoContractAddress = (networkId: string) => {
  if (networkId === OnekeyNetwork.eth) {
    return MainnetLidoContractAddress;
  }
  if (networkId === OnekeyNetwork.goerli) {
    return TestnetLidoContractAddress;
  }
  throw new Error('Not supported network');
};

export const getKeleContractAddress = (networkId: string): string => {
  if (networkId === OnekeyNetwork.eth) {
    return MainnetKeleContractAddress;
  }
  if (networkId === OnekeyNetwork.goerli) {
    return TestnetKeleContractAddress;
  }
  throw new Error('Not supported network');
};

export const getLidoNFTContractAddress = (networkId: string) => {
  if (networkId === OnekeyNetwork.eth) {
    return MainnetLidoWithdrawalERC721;
  }
  if (networkId === OnekeyNetwork.goerli) {
    return TestnetLidoWithdrawalERC721;
  }
  throw new Error('Not supported network');
};
