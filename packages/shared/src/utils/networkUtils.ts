import {
  BtcDappNetworkTypes,
  BtcDappUniSetChainTypes,
  EBtcDappNetworkTypeEnum,
  EBtcDappUniSetChainTypeEnum,
} from '../../types/ProviderApis/ProviderApiBtc.type';
import { getNetworkIdsMap } from '../config/networkIds';
import {
  getDefaultEnabledNetworksInAllNetworks,
  getPresetNetworks,
} from '../config/presetNetworks';
import {
  COINTYPE_LIGHTNING,
  COINTYPE_LIGHTNING_TESTNET,
  IMPL_EVM,
  IMPL_LIGHTNING,
  IMPL_LIGHTNING_TESTNET,
  IMPL_SOL,
  IMPL_TRON,
  SEPERATOR,
} from '../engine/engineConsts';
import platformEnv from '../platformEnv';

import numberUtils from './numberUtils';

import type { IServerNetwork } from '../../types';

const defaultEnabledNetworks = getDefaultEnabledNetworksInAllNetworks();
const defaultEnabledNetworkIds = defaultEnabledNetworks.map((n) => n.id);

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

function isEvmNetwork({ networkId }: { networkId: string | undefined }) {
  return Boolean(networkId && getNetworkImpl({ networkId }) === IMPL_EVM);
}

function isTronNetworkByNetworkId(networkId?: string) {
  return Boolean(networkId && getNetworkImpl({ networkId }) === IMPL_TRON);
}

function getNetworkImplOrNetworkId({
  networkId,
}: {
  networkId: string | undefined;
}): string | undefined {
  if (networkId) {
    const impl = getNetworkImpl({ networkId });
    if (impl === IMPL_EVM) {
      return impl;
    }
    return networkId;
  }
  return networkId;
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

function isSolanaNetworkByNetworkId(networkId?: string) {
  return Boolean(networkId && getNetworkImpl({ networkId }) === IMPL_SOL);
}

function isBTCNetwork(networkId?: string) {
  // networkId === getNetworkIdsMap().rbtc // TODO
  return (
    networkId === getNetworkIdsMap().btc ||
    networkId === getNetworkIdsMap().tbtc ||
    networkId === getNetworkIdsMap().sbtc
  );
}

export function getBtcDappNetworkName(network: IServerNetwork) {
  if (network && isBTCNetwork(network.id)) {
    if (network.isTestnet) {
      if (network.id === getNetworkIdsMap().sbtc) {
        return Promise.resolve(
          BtcDappNetworkTypes[EBtcDappNetworkTypeEnum.SIGNET].name,
        );
      }
      return Promise.resolve(
        BtcDappNetworkTypes[EBtcDappNetworkTypeEnum.TESTNET].name,
      );
    }
    return Promise.resolve(
      BtcDappNetworkTypes[EBtcDappNetworkTypeEnum.MAINNET].name,
    );
  }
}

export function getBtcDappUniSetChainName(network: IServerNetwork) {
  if (network && isBTCNetwork(network.id)) {
    if (network.isTestnet) {
      if (network.id === getNetworkIdsMap().sbtc) {
        return Promise.resolve(
          BtcDappUniSetChainTypes[EBtcDappUniSetChainTypeEnum.BITCOIN_SIGNET],
        );
      }
      return Promise.resolve(
        BtcDappUniSetChainTypes[EBtcDappUniSetChainTypeEnum.BITCOIN_TESTNET],
      );
    }
    return Promise.resolve(
      BtcDappUniSetChainTypes[EBtcDappUniSetChainTypeEnum.BITCOIN_MAINNET],
    );
  }
}

export function isEnabledNetworksInAllNetworks({
  networkId,
  disabledNetworks,
  enabledNetworks,
  isTestnet,
}: {
  networkId: string;
  disabledNetworks: Record<string, boolean>;
  enabledNetworks: Record<string, boolean>;
  isTestnet: boolean;
}) {
  if (isTestnet) {
    return !!enabledNetworks[networkId];
  }

  if (defaultEnabledNetworkIds.includes(networkId)) {
    return !disabledNetworks[networkId];
  }

  return !!enabledNetworks[networkId];
}

function isAllNetwork({
  networkId,
}: {
  networkId: string | undefined;
}): boolean {
  return Boolean(networkId && networkId === getNetworkIdsMap().onekeyall);
}

function getDefaultDeriveTypeVisibleNetworks() {
  return platformEnv.isE2E
    ? [
        getNetworkIdsMap().eth,
        getNetworkIdsMap().sol,
        getNetworkIdsMap().btc,
        getNetworkIdsMap().tbtc,
        getNetworkIdsMap().sbtc,
        getNetworkIdsMap().ltc,
      ]
    : [
        getNetworkIdsMap().btc,
        getNetworkIdsMap().tbtc,
        getNetworkIdsMap().sbtc,
        getNetworkIdsMap().ltc,
      ];
}

function isViewInExplorerDisabled({ networkId }: { networkId: string }) {
  return (
    networkId === getNetworkIdsMap().lightning ||
    networkId === getNetworkIdsMap().tlightning ||
    networkId === getNetworkIdsMap().nostr
  );
}

function toNetworkIdFallback({
  networkId,
  allNetworkFallbackId,
  allNetworkFallbackToBtc,
}: {
  networkId: string | undefined;
  allNetworkFallbackId?: string;
  allNetworkFallbackToBtc?: boolean;
}): string | undefined {
  if (isAllNetwork({ networkId })) {
    if (allNetworkFallbackToBtc) {
      return getNetworkIdsMap().btc;
    }
    return allNetworkFallbackId;
  }
  return networkId;
}

function getLocalNetworkInfo(networkId: string) {
  const networks = getPresetNetworks();
  return networks.find((network) => network.id === networkId);
}

export default {
  getNetworkChainId,
  getNetworkImpl,
  getNetworkImplOrNetworkId,
  isEvmNetwork,
  parseNetworkId,
  isLightningNetwork,
  isLightningNetworkByImpl,
  isLightningNetworkByNetworkId,
  isSolanaNetworkByNetworkId,
  isTronNetworkByNetworkId,
  isBTCNetwork,
  getBtcDappNetworkName,
  isAllNetwork,
  getDefaultDeriveTypeVisibleNetworks,
  toNetworkIdFallback,
  getBtcDappUniSetChainName,
  getLocalNetworkInfo,
  isViewInExplorerDisabled,
};
