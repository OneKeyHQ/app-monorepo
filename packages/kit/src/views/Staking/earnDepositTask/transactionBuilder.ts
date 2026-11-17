import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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

export async function buildEarnStakeConfirmationOrServerOrder({
  request,
  stakingInfo,
}: {
  request: IStakeBaseParams;
  stakingInfo?: IStakingInfo | null;
}) {
  const stakeTx =
    await backgroundApiProxy.serviceStaking.buildStakeTransaction(request);
  if (!stakeTx.tx) {
    if (!stakeTx.orderId) {
      throw new OneKeyLocalError(
        'Stake response has neither a transaction nor an orderId',
      );
    }
    return { serverOrderId: stakeTx.orderId };
  }
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

export async function buildEarnStakeConfirmation(params: {
  request: IStakeBaseParams;
  stakingInfo?: IStakingInfo | null;
}) {
  const payload = await buildEarnStakeConfirmationOrServerOrder(params);
  if ('serverOrderId' in payload) {
    throw new OneKeyLocalError(
      'Deposit task cannot be executed by the protocol',
    );
  }
  return payload;
}
