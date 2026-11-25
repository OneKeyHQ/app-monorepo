import { normalizeTaskAccountAddress } from '@onekeyhq/kit/src/views/Earn/tasks/taskAddress';
import type {
  IEarnTokenInfo,
  IEarnTokenItem,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import type { IDepositTaskIdentity } from './state';

function matchesRetainedTokenAddress({
  token,
  networkId,
  inputTokenAddress,
}: {
  token: IToken;
  networkId: string;
  inputTokenAddress: string;
}) {
  if (!inputTokenAddress) return token.isNative;
  return (
    !token.isNative &&
    Boolean(token.address) &&
    normalizeTaskAccountAddress(networkId, token.address) ===
      normalizeTaskAccountAddress(networkId, inputTokenAddress)
  );
}

export function isRetainedDepositToken({
  tokenInfo,
  identity,
}: {
  tokenInfo?: IEarnTokenInfo;
  identity: Pick<
    IDepositTaskIdentity,
    'accountId' | 'networkId' | 'inputTokenAddress'
  >;
}) {
  return Boolean(
    tokenInfo &&
    tokenInfo.accountId === identity.accountId &&
    tokenInfo.networkId === identity.networkId &&
    tokenInfo.token.networkId === identity.networkId &&
    matchesRetainedTokenAddress({
      token: tokenInfo.token,
      networkId: identity.networkId,
      inputTokenAddress: identity.inputTokenAddress,
    }),
  );
}

export function findRetainedDepositAsset({
  assets,
  networkId,
  inputTokenAddress,
}: {
  assets: IEarnTokenItem[];
  networkId: string;
  inputTokenAddress: string;
}) {
  return assets.find(({ info }) =>
    matchesRetainedTokenAddress({ token: info, networkId, inputTokenAddress }),
  );
}
