import {
  BtcDappNetworkTypes,
  EBtcDappNetworkTypeEnum,
} from '../../types/ProviderApis/ProviderApiBtc.type';
import { getNetworkIdsMap } from '../config/networkIds';
import {
  COINTYPE_LIGHTNING,
  COINTYPE_LIGHTNING_TESTNET,
  IMPL_LIGHTNING,
  IMPL_LIGHTNING_TESTNET,
  SEPERATOR,
} from '../engine/engineConsts';

import numberUtils from './numberUtils';

import type { IServerNetwork } from '../../types';

function parseNetworkId({ networkId }: { networkId: string }) {
  const [impl, chainId] = networkId.split(SEPERATOR);
  return { impl, chainId };
}

function getNetworkChainId({
  networkId,
  hex = false,
}: {
  networkId: string;
  hex?: boolean;
}): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { impl, chainId } = parseNetworkId({ networkId });
  return hex ? numberUtils.numberToHex(chainId) : chainId;
}

function getNetworkImpl({ networkId }: { networkId: string }): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { impl, chainId } = parseNetworkId({ networkId });
  return impl;
}

function isLightningNetwork(coinType: string) {
  return (
    coinType === COINTYPE_LIGHTNING || coinType === COINTYPE_LIGHTNING_TESTNET
  );
}

function isLightningNetworkByImpl(impl?: string) {
  return impl === IMPL_LIGHTNING || impl === IMPL_LIGHTNING_TESTNET;
}

function isLightningNetworkByNetworkId(networkId?: string) {
  const networkIdsMap = getNetworkIdsMap();
  return (
    networkId === networkIdsMap.lightning ||
    networkId === networkIdsMap.tlightning
  );
}

function isBTCNetwork(networkId?: string) {
  return (
    networkId === getNetworkIdsMap().btc ||
    networkId === getNetworkIdsMap().tbtc
  );
}

export function getBtcDappNetworkName(network: IServerNetwork) {
  if (network && isBTCNetwork(network.id)) {
    if (network.isTestnet) {
      return Promise.resolve(
        BtcDappNetworkTypes[EBtcDappNetworkTypeEnum.TESTNET].name,
      );
    }
    return Promise.resolve(
      BtcDappNetworkTypes[EBtcDappNetworkTypeEnum.MAINNET].name,
    );
  }
}

export default {
  getNetworkChainId,
  getNetworkImpl,
  parseNetworkId,
  isLightningNetwork,
  isLightningNetworkByImpl,
  isLightningNetworkByNetworkId,
  isBTCNetwork,
  getBtcDappNetworkName,
};
