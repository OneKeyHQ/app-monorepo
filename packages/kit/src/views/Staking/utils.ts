import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import {
  MainnetLidoContractAddress,
  TestnetLidoContractAddress,
} from './config';

export const isSupportStakedAssets = (
  networkId?: string,
  tokenIdOnNetwork?: string,
): boolean => {
  const networkIds = [OnekeyNetwork.eth, OnekeyNetwork.goerli] as string[];
  const result =
    networkId && networkIds.includes(networkId) && !tokenIdOnNetwork;
  return Boolean(result);
};

export const getLidoTokenEvmAddress = (
  networkId?: string,
  tokenIdOnNetwork?: string,
): string | undefined => {
  if (!networkId) {
    return undefined;
  }
  if (networkId === OnekeyNetwork.goerli && !tokenIdOnNetwork) {
    return TestnetLidoContractAddress;
  }
  if (networkId === OnekeyNetwork.eth && !tokenIdOnNetwork) {
    return MainnetLidoContractAddress;
  }
  return undefined;
};

export const isSTETH = (networkId?: string, tokenIdOnNetwork?: string) => {
  if (networkId && tokenIdOnNetwork) {
    return (
      (networkId === OnekeyNetwork.goerli &&
        tokenIdOnNetwork.toLowerCase() ===
          TestnetLidoContractAddress.toLowerCase()) ||
      (networkId === OnekeyNetwork.eth &&
        tokenIdOnNetwork.toLowerCase() ===
          MainnetLidoContractAddress.toLowerCase())
    );
  }
  return false;
};
