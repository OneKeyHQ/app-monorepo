import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

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
  if (openInExternal) {
    openUrlExternal(url);
  } else {
    openUrlInApp(url);
  }
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
  if (openInExternal) {
    openUrlExternal(url);
  } else {
    openUrlInApp(url);
  }
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
  if (openInExternal) {
    openUrlExternal(url);
  } else {
    openUrlInApp(url);
  }
};
