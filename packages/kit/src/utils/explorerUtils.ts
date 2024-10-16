import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export const openExplorerAddressUrl = async ({
  networkId,
  address,
}: {
  networkId?: string;
  address?: string;
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
  openUrlInApp(url);
};

export const openTransactionDetailsUrl = async ({
  networkId,
  txid,
}: {
  networkId?: string;
  txid?: string;
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
  openUrlInApp(url);
};

export const openTokenDetailsUrl = async ({
  networkId,
  tokenAddress,
}: {
  networkId?: string;
  tokenAddress?: string;
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
  openUrlInApp(url);
};
