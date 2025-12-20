import { md5 } from 'js-md5';

import {
  TRON_SOURCE_FLAG_MAINNET,
  TRON_SOURCE_FLAG_TESTNET,
} from '@onekeyhq/core/src/chains/tron/constants';

function buildTronClaimResourceParams({
  accountAddress,
  isTestnet,
}: {
  accountAddress: string;
  isTestnet: boolean;
}) {
  const timestamp = Date.now();

  const claimSource = isTestnet
    ? TRON_SOURCE_FLAG_TESTNET
    : TRON_SOURCE_FLAG_MAINNET;

  const addressUpperCase = accountAddress.toUpperCase();
  const sign = `${addressUpperCase}${timestamp}${claimSource}${addressUpperCase.slice(
    0,
    4,
  )}${addressUpperCase.slice(
    addressUpperCase.length - 4,
    addressUpperCase.length,
  )}`;
  const signed = md5(sign);

  return {
    claimSource,
    timestamp,
    signed,
  };
}

export default {
  buildTronClaimResourceParams,
};
