import {
  HYPERLIQUID_EXPLORER_URL,
  HYPERLIQUID_TOKEN_EXPLORER_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

// Single home for the explorer-link target policy: callers may force a
// target via openInExternal; otherwise desktop and native open the system
// or in-app browser, web/ext open the WebView modal.
const openExplorerUrl = (url: string, openInExternal?: boolean) => {
  if (openInExternal ?? (platformEnv.isDesktop || platformEnv.isNative)) {
    openUrlExternal(url);
  } else {
    openUrlInApp(url);
  }
};

export const openExplorerAddressUrl = async ({
  networkId,
  address,
  openInExternal,
}: {
  networkId?: string;
  address?: string;
  openInExternal?: boolean;
}) => {
  if (!networkId || !address) {
    return;
  }
  const params = {
    networkId,
    param: address,
    type: 'address' as const,
  };
  const url = await backgroundApiProxy.serviceExplorer.buildExplorerUrl(params);
  openExplorerUrl(url, openInExternal);
};

export const openTransactionDetailsUrl = async ({
  networkId,
  txid,
  openInExternal,
}: {
  networkId?: string;
  txid?: string;
  openInExternal?: boolean;
}) => {
  if (!networkId || !txid) {
    return;
  }
  const params = {
    networkId,
    param: txid,
    type: 'transaction' as const,
  };
  const url = await backgroundApiProxy.serviceExplorer.buildExplorerUrl(params);
  openExplorerUrl(url, openInExternal);
};

export const openBlockExplorerUrl = async ({
  networkId,
  blockHeight,
  openInExternal,
}: {
  networkId?: string;
  blockHeight?: string;
  openInExternal?: boolean;
}) => {
  if (!networkId || !blockHeight) {
    return;
  }
  const params = {
    networkId,
    param: blockHeight,
    type: 'block' as const,
  };
  const url = await backgroundApiProxy.serviceExplorer.buildExplorerUrl(params);
  if (!url) {
    return;
  }
  openExplorerUrl(url, openInExternal);
};

export const openTokenDetailsUrl = async ({
  networkId,
  tokenAddress,
  openInExternal,
}: {
  networkId?: string;
  tokenAddress?: string;
  openInExternal?: boolean;
}) => {
  if (!networkId || !tokenAddress) {
    return;
  }
  const params = {
    networkId,
    param: tokenAddress,
    type: 'token' as const,
  };
  const url = await backgroundApiProxy.serviceExplorer.buildExplorerUrl(params);
  openExplorerUrl(url, openInExternal);
};

export const openHyperLiquidExplorerUrl = async ({
  address,
  openInExternal,
}: {
  address?: string;
  openInExternal?: boolean;
}) => {
  if (address) {
    openExplorerUrl(`${HYPERLIQUID_EXPLORER_URL}${address}`, openInExternal);
  }
};

export const openHyperLiquidTokenExplorerUrl = async ({
  tokenId,
  openInExternal,
}: {
  tokenId?: string;
  openInExternal?: boolean;
}) => {
  if (tokenId) {
    openExplorerUrl(
      `${HYPERLIQUID_TOKEN_EXPLORER_URL}${tokenId}`,
      openInExternal,
    );
  }
};
