import BigNumber from 'bignumber.js';
import { isEmpty, isNil, sortBy, uniqBy } from 'lodash';

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

function sortChainSelectorNetworksByValue({
  chainSelectorNetworks,
  accountNetworkValues,
}: {
  chainSelectorNetworks: {
    mainnetItems: IServerNetwork[];
    testnetItems: IServerNetwork[];
    frequentlyUsedItems: IServerNetwork[];
    unavailableItems: IServerNetwork[];
    allNetworkItem?: IServerNetwork;
  };
  accountNetworkValues: Record<string, string>;
}) {
  if (isEmpty(accountNetworkValues)) {
    return {
      chainSelectorNetworks,
      formattedAccountNetworkValues: {},
    };
  }

  const formattedAccountNetworkValues: Record<string, string> = {};

  for (const [key, value] of Object.entries(accountNetworkValues)) {
    const [_, networkId] = key.split('_') as [string, string];
    if (isNil(formattedAccountNetworkValues[networkId])) {
      formattedAccountNetworkValues[networkId] = value;
    } else {
      formattedAccountNetworkValues[networkId] = new BigNumber(
        formattedAccountNetworkValues[networkId],
      )
        .plus(value)
        .toFixed();
    }
  }

  // if network in frequentlyUsedItems do not has value or value is 0, remove it from frequentlyUsedItems
  let frequentlyUsedItems = chainSelectorNetworks.frequentlyUsedItems.filter(
    (item) => {
      return new BigNumber(formattedAccountNetworkValues[item.id] ?? '0').gt(
        '0',
      );
    },
  );

  // check if any network in mainnetItems has non-zero value, add it to frequentlyUsedItems
  for (const item of chainSelectorNetworks.mainnetItems) {
    if (new BigNumber(formattedAccountNetworkValues[item.id] ?? '0').gt(0)) {
      frequentlyUsedItems.push(item);
    }
  }

  if (isEmpty(frequentlyUsedItems)) {
    return {
      chainSelectorNetworks,
      formattedAccountNetworkValues,
    };
  }

  // uniq frequentlyUsedItems and sort by value
  frequentlyUsedItems = uniqBy(frequentlyUsedItems, 'id').sort((a, b) => {
    return new BigNumber(formattedAccountNetworkValues[b.id] ?? '0').comparedTo(
      new BigNumber(formattedAccountNetworkValues[a.id] ?? '0'),
    );
  });

  return {
    chainSelectorNetworks: {
      ...chainSelectorNetworks,
      frequentlyUsedItems,
    },
    formattedAccountNetworkValues,
  };
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
  getNetworkShortCode,
  getNetworkIdFromShortCode,
  isViewInExplorerDisabled,
  isAggregateNetwork,
  sortChainSelectorNetworksByValue,
};
