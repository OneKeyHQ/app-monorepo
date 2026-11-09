import type {
  IStakeHistoriesResponse,
  IStakeHistory,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

export function resolvePendingTokenLogo({
  token,
  network,
  networks,
}: {
  token: IToken;
  network?: IStakeHistoriesResponse['network'];
  networks?: IStakeHistoriesResponse['networks'];
}): string | undefined {
  if (token.logoURI) {
    return token.logoURI;
  }
  if (!token.isNative || !token.networkId) {
    return undefined;
  }
  return (
    networks?.find((item) => item.networkId === token.networkId)?.logoURI ??
    (network?.networkId === token.networkId ? network.logoURI : undefined)
  );
}

export function buildPendingStakeHistory({
  decodedTx,
  stakingInfo,
  title,
  tokens,
}: {
  decodedTx: Pick<IDecodedTx, 'txid' | 'createdAt' | 'updatedAt' | 'networkId'>;
  stakingInfo: IStakingInfo;
  title: string;
  tokens: IStakeHistoriesResponse['tokens'];
}): IStakeHistory {
  const action = stakingInfo.send ?? stakingInfo.receive;
  const localToken = action?.token;
  const matchingToken =
    localToken && !localToken.logoURI && localToken.networkId
      ? tokens.find(
          (item) =>
            item.info?.address === localToken.address &&
            item.info?.networkId === localToken.networkId,
        )
      : undefined;
  const remoteLogo = matchingToken?.info?.logoURI;
  const displayToken =
    localToken && remoteLogo
      ? { ...localToken, logoURI: remoteLogo }
      : localToken;
  return {
    txHash: decodedTx.txid,
    timestamp: decodedTx.createdAt ?? decodedTx.updatedAt ?? 0,
    title,
    direction: stakingInfo.send ? 'send' : 'receive',
    amount: action?.amount,
    networkId: stakingInfo.receive?.token?.networkId ?? decodedTx.networkId,
    token: displayToken ? { info: displayToken } : undefined,
    tokenAddress: action?.token.address ?? '',
  };
}
