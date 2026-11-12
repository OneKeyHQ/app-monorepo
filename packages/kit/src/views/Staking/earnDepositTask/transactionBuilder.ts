import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  EInternalDappEnum,
  EInternalStakingAction,
  type IStakeBaseParams,
  type IStakingInfo,
} from '@onekeyhq/shared/types/staking';

export function createStakeInfoWithOrderId({
  stakingInfo,
  orderId,
}: {
  stakingInfo: IStakingInfo | undefined;
  orderId?: string;
}): IStakingInfo | undefined {
  return stakingInfo
    ? { ...stakingInfo, ...(orderId ? { orderId } : undefined) }
    : undefined;
}

export async function buildEarnStakeConfirmation({
  request,
  stakingInfo,
}: {
  request: IStakeBaseParams & { expectedAccountAddress?: string };
  stakingInfo?: IStakingInfo | null;
}) {
  const stakeTx =
    await backgroundApiProxy.serviceStaking.buildStakeTransaction(request);
  const encodedTx = await backgroundApiProxy.serviceStaking.buildInternalDappTx(
    {
      networkId: request.networkId,
      accountId: request.accountId,
      tx: stakeTx.tx,
      internalDappType: EInternalDappEnum.Staking,
      stakingAction: EInternalStakingAction.Stake,
    },
  );
  const hasBtcFee =
    networkUtils.isBTCNetwork(request.networkId) &&
    (encodedTx as IEncodedTxBtc).fee;
  return {
    encodedTx,
    stakeInfoWithOrderId: createStakeInfoWithOrderId({
      stakingInfo: stakingInfo ?? undefined,
      orderId: stakeTx.orderId,
    }),
    useFeeInTx: hasBtcFee ? true : undefined,
    feeInfoEditable: hasBtcFee ? false : undefined,
  };
}
