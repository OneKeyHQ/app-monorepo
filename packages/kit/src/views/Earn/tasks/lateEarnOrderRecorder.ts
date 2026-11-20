import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import type { IBroadcastAcceptedFact } from '@onekeyhq/shared/types/tx';

type ILateEarnOrderResult =
  | 'identityMismatch'
  | 'orderMismatch'
  | 'notTracked'
  | 'localFailed'
  | 'localUnavailable'
  | 'remoteUnknown'
  | 'existingOrder'
  | 'superseded'
  | 'synced';

/** One recorder belongs to one task and retains ambiguous remote outcomes. */
export function createLateEarnOrderRecorder() {
  const attempts = new Map<string, Promise<ILateEarnOrderResult>>();

  return async ({
    fact,
    accountId,
    networkId,
    stakeInfo,
    orderId: explicitOrderId,
  }: {
    fact: IBroadcastAcceptedFact;
    accountId: string;
    networkId: string;
    stakeInfo?: IStakingInfo;
    orderId?: string;
  }): Promise<ILateEarnOrderResult> => {
    if (
      !accountId ||
      !networkId ||
      fact.accountId !== accountId ||
      fact.networkId !== networkId ||
      !fact.uuid?.trim() ||
      !fact.txid?.trim()
    ) {
      return 'identityMismatch';
    }
    if (
      explicitOrderId !== undefined &&
      stakeInfo?.orderId !== undefined &&
      explicitOrderId !== stakeInfo.orderId
    ) {
      return 'orderMismatch';
    }
    const orderId = explicitOrderId ?? stakeInfo?.orderId;
    if (!orderId) return 'notTracked';

    const key = JSON.stringify([
      accountId,
      networkId,
      orderId,
      fact.uuid,
      fact.txid,
    ]);
    const existing = attempts.get(key);
    if (existing) return existing;

    const attempt = (async (): Promise<ILateEarnOrderResult> => {
      try {
        const result = await backgroundApiProxy.serviceStaking.addEarnOrder(
          {
            orderId,
            networkId,
            txId: fact.txid,
            status: EDecodedTxStatus.Pending,
            stakingLabel: stakeInfo?.label,
            stakingProtocol: stakeInfo?.protocol,
            stakingTags: stakeInfo ? [...stakeInfo.tags] : undefined,
          },
          { remoteSync: 'once', preserveExistingTx: true },
        );
        if (
          result.localStatus === 'existing' &&
          result.remoteStatus === 'skipped'
        )
          return 'existingOrder';
        if (
          result.localStatus === 'failed' &&
          result.remoteStatus === 'notAttempted'
        )
          return 'localFailed';
        if (
          result.localStatus === 'unavailable' &&
          result.remoteStatus === 'notAttempted'
        )
          return 'localUnavailable';
        if (
          result.localStatus === 'superseded' &&
          result.remoteStatus === 'skipped'
        )
          return 'superseded';
        if (result.localStatus === 'saved' && result.remoteStatus === 'synced')
          return 'synced';
        return 'remoteUnknown';
      } catch {
        return 'remoteUnknown';
      }
    })();
    attempts.set(key, attempt);
    const result = await attempt;
    if (result === 'localFailed' || result === 'localUnavailable') {
      if (attempts.get(key) === attempt) attempts.delete(key);
    }
    return result;
  };
}

/** The callback is bound to the confirmation attempt that received the fact. */
export function createLateEarnOrderObserver({
  accountId,
  networkId,
  onError,
}: {
  accountId: string;
  networkId: string;
  onError: (result: ILateEarnOrderResult) => void;
}) {
  const record = createLateEarnOrderRecorder();
  return async ({
    fact,
    stakeInfo,
    orderId,
    onAccepted,
  }: {
    fact: IBroadcastAcceptedFact;
    stakeInfo?: IStakingInfo;
    orderId?: string;
    onAccepted: (txid: string) => boolean;
  }) => {
    if (
      fact.accountId !== accountId ||
      fact.networkId !== networkId ||
      !fact.uuid.trim() ||
      !fact.txid.trim() ||
      !onAccepted(fact.txid)
    )
      return;
    const result = await record({
      fact,
      accountId,
      networkId,
      stakeInfo,
      orderId,
    });
    if (
      result !== 'synced' &&
      result !== 'notTracked' &&
      result !== 'superseded'
    )
      onError(result);
  };
}
