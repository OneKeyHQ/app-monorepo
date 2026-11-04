import {
  BtcDappNetworkTypes,
  BtcDappUniSetChainTypes,
  EBtcDappNetworkTypeEnum,
  EBtcDappUniSetChainTypeEnum,
} from '../../types/ProviderApis/ProviderApiBtc.type';
import { getNetworkIdsMap } from '../config/networkIds';
import {
  getDefaultEnabledNetworkIdsInAllNetworks,
  getPresetNetworks,
} from '../config/presetNetworks';
import { AGGREGATE_TOKEN_MOCK_NETWORK_ID } from '../consts/networkConsts';
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

const defaultEnabledNetworkIds = new Set(
  getDefaultEnabledNetworkIdsInAllNetworks(),
);

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

function isBTCMainnet(networkId?: string) {
  return networkId === getNetworkIdsMap().btc;
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

  if (defaultEnabledNetworkIds.has(networkId)) {
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

function isAggregateNetwork({
  networkId,
}: {
  networkId: string | undefined;
}): boolean {
  return Boolean(networkId && networkId === AGGREGATE_TOKEN_MOCK_NETWORK_ID);
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

function getNetworkShortCode({
  networkId,
}: {
  networkId: string;
}): string | undefined {
  const networkInfo = getLocalNetworkInfo(networkId);
  return networkInfo?.shortcode;
}

function getNetworkIdFromShortCode({
  shortCode,
}: {
  shortCode: string;
}): string | undefined {
  const networkIdsMap = getNetworkIdsMap();
  return networkIdsMap[shortCode as keyof typeof networkIdsMap];
}

function getEnabledNFTNetworkIds(): string[] {
  const networkIdsMap = getNetworkIdsMap();

  return [
    networkIdsMap.onekeyall,
    networkIdsMap.eth,
    networkIdsMap.base,
    networkIdsMap.optimism,
    networkIdsMap.bsc,
    networkIdsMap.polygon,
    networkIdsMap.arbitrum,
    networkIdsMap.avalanche,
    networkIdsMap.sol,
    networkIdsMap.hyperevm,
  ];
}

function _getEnabledDeFiNetworkIds(): string[] {
  const networkIdsMap = getNetworkIdsMap();
  return [
    networkIdsMap.onekeyall,
    networkIdsMap.eth,
    networkIdsMap.base,
    networkIdsMap.optimism,
    networkIdsMap.bsc,
    networkIdsMap.polygon,
    networkIdsMap.arbitrum,
    networkIdsMap.avalanche,
    networkIdsMap.sol,
  ];
}

function getEnabledExportHistoryNetworkIds(): string[] {
  const networkIdsMap = getNetworkIdsMap();
  return [
    networkIdsMap.base,
    networkIdsMap.btc,
    networkIdsMap.etc,
    networkIdsMap.tbtc,
    networkIdsMap.doge,
    networkIdsMap.ltc,
    networkIdsMap.bch,
    networkIdsMap.sepolia,
    networkIdsMap.arbitrum,
    networkIdsMap.avalanche,
    networkIdsMap.optimism,
    networkIdsMap.eth,
    networkIdsMap.trx,
    networkIdsMap.bsc,
    networkIdsMap.polygon,
    networkIdsMap.sol,
  ];
}

// Fixed "Popular" block for address / receive network lists, ordered by
// receive volume over the last 30 days. Networks missing from the available
// list are skipped, not back-filled. A server list can replace it later.
export const POPULAR_NETWORK_IDS: string[] = [
  'tron--0x2b6653dc', // Tron
  'btc--0', // Bitcoin
  'evm--1', // Ethereum
  'evm--56', // BNB Chain
  'sol--101', // Solana
  'evm--42161', // Arbitrum
  'evm--137', // Polygon
  'evm--8453', // Base
  'evm--4663', // Robinhood Chain
  'xrp--0', // XRP Ledger
];

export type INetworkListSection = {
  title?: string;
  data: IServerNetwork[];
};

// Popular block first (fixed order), then the rest grouped by the first
// letter of the name. Popular networks never repeat in the letter groups.
export function buildPopularFirstNetworkSections({
  networks,
  popularNetworkIds = POPULAR_NETWORK_IDS,
  popularTitle,
}: {
  networks: IServerNetwork[];
  popularNetworkIds?: string[];
  popularTitle?: string;
}): INetworkListSection[] {
  const byId = new Map(networks.map((network) => [network.id, network]));
  const popular = popularNetworkIds
    .map((id) => byId.get(id))
    .filter((network): network is IServerNetwork => !!network);
  const popularSet = new Set(popular.map((network) => network.id));

  const groups: Record<string, IServerNetwork[]> = {};
  networks.forEach((network) => {
    if (popularSet.has(network.id)) {
      return;
    }
    const char = (network.name[0] ?? '#').toUpperCase();
    if (!groups[char]) {
      groups[char] = [];
    }
    groups[char].push(network);
  });
  const letterSections = Object.entries(groups)
    .map(([title, data]) => ({ title, data }))
    .toSorted((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0));

  return popular.length
    ? [{ title: popularTitle, data: popular }, ...letterSections]
    : letterSections;
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
  isBTCMainnet,
  getBtcDappNetworkName,
  isAllNetwork,
  getDefaultDeriveTypeVisibleNetworks,
  toNetworkIdFallback,
  getBtcDappUniSetChainName,
  getLocalNetworkInfo,
  getNetworkShortCode,
  getNetworkIdFromShortCode,
  isViewInExplorerDisabled,
  isAggregateNetwork,
  getEnabledNFTNetworkIds,
  getEnabledExportHistoryNetworkIds,
};
