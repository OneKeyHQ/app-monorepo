import { SEPERATOR } from '../engine/engineConsts';

import numberUtils from './numberUtils';

function getNetworkChainId({
  networkId,
  hex = false,
}: {
  networkId: string;
  hex?: boolean;
}): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [impl, chainId] = networkId.split(SEPERATOR);
  return hex ? numberUtils.numberToHex(chainId) : chainId;
}

function getNetworkImpl({ networkId }: { networkId: string }): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [impl, chainId] = networkId.split(SEPERATOR);
  return impl;
}

export default {
  getNetworkChainId,
  getNetworkImpl,
};
