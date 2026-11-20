import BigNumber from 'bignumber.js';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isEarnSwapRecovery } from '@onekeyhq/shared/src/utils/earnSwapRecovery';
import type {
  IEarnFundingChange,
  IEarnFundingReceipt,
  IEarnFundingState,
} from '@onekeyhq/shared/types/earn/funding';

import {
  SimpleDbEntityBase,
  withWebEntityLock,
} from '../base/SimpleDbEntityBase';

type IFundingRecord = {
  attemptId: string;
  group?: string;
  source?: IEarnFundingReceipt;
  state: IEarnFundingState;
};
type IFundingRecords = Record<string, IFundingRecord>;
type IFundingUpdate =
  | IEarnFundingChange
  | { type: 'recoverSwap'; uuid: string; txId: string; sourceTxFailed?: true };

function isValidAmount(amount: unknown, allowZero = false): amount is string {
  return (
    typeof amount === 'string' &&
    amount.length <= 128 &&
    /^\d+(\.\d+)?$/.test(amount) &&
    (allowZero || new BigNumber(amount).gt(0))
  );
}

function isValidId(id: unknown, maxLength = 256): id is string {
  return (
    typeof id === 'string' && id.trim().length > 0 && id.length <= maxLength
  );
}

function isValidReceipt(receipt: unknown): receipt is IEarnFundingReceipt {
  return Boolean(
    receipt &&
    typeof receipt === 'object' &&
    'scope' in receipt &&
    isValidId(receipt.scope, 2048) &&
    'txId' in receipt &&
    isValidId(receipt.txId),
  );
}

function isValidRecord(record: unknown): record is IFundingRecord {
  if (
    !record ||
    typeof record !== 'object' ||
    !('attemptId' in record) ||
    !isValidId(record.attemptId) ||
    !('state' in record) ||
    !record.state ||
    typeof record.state !== 'object'
  ) {
    return false;
  }
  const { state } = record;
  if (
    'group' in record &&
    record.group !== undefined &&
    !isValidId(record.group, 2048)
  )
    return false;
  if (
    'source' in record &&
    record.source !== undefined &&
    !isValidReceipt(record.source)
  )
    return false;
  if (
    'intentAmount' in state &&
    state.intentAmount !== undefined &&
    !isValidAmount(state.intentAmount)
  )
    return false;
  if (
    'positionBefore' in state &&
    state.positionBefore !== undefined &&
    !isValidAmount(state.positionBefore, true)
  )
    return false;
  if (
    'swapRecovery' in state &&
    state.swapRecovery !== undefined &&
    !isEarnSwapRecovery(state.swapRecovery)
  )
    return false;
  if (
    'swapTxUuid' in state &&
    state.swapTxUuid !== undefined &&
    !isValidId(state.swapTxUuid)
  )
    return false;
  if (!('status' in state)) return false;
  if (state.status === 'unknown') return true;
  if (!('txId' in state) || !isValidId(state.txId)) return false;
  if (
    'sourceTxFailed' in state &&
    state.sourceTxFailed !== true &&
    state.sourceTxFailed !== undefined
  )
    return false;
  return (
    state.status === 'submitted' ||
    (state.status === 'funded' &&
      'receivedAmount' in state &&
      isValidAmount(state.receivedAmount))
  );
}

function readRecord(
  records: IFundingRecords | null | undefined,
  scope: string,
) {
  return records && Object.hasOwn(records, scope) ? records[scope] : undefined;
}

function getFundingState(record: IFundingRecord | undefined) {
  if (!record) return null;
  return record.source
    ? { ...record.state, source: record.source }
    : record.state;
}

function applyChange(
  current: IFundingRecord | undefined,
  change: IFundingUpdate,
): IFundingRecord | undefined {
  if (change.type === 'claim') {
    if (
      current ||
      !isValidId(change.attemptId) ||
      (change.intentAmount !== undefined &&
        !isValidAmount(change.intentAmount)) ||
      (change.positionBefore !== undefined &&
        !isValidAmount(change.positionBefore, true)) ||
      (change.swapRecovery !== undefined &&
        !isEarnSwapRecovery(change.swapRecovery)) ||
      (change.swapTxUuid !== undefined && !isValidId(change.swapTxUuid))
    )
      return current;
    return {
      attemptId: change.attemptId,
      group: change.group,
      source: change.source,
      state: {
        status: 'unknown',
        intentAmount: change.intentAmount,
        positionBefore: change.positionBefore,
        ...(change.swapRecovery ? { swapRecovery: change.swapRecovery } : {}),
        ...(change.swapTxUuid ? { swapTxUuid: change.swapTxUuid } : {}),
      },
    };
  }
  if (!current) return current;
  const { attemptId, state } = current;
  const { intentAmount, positionBefore, swapRecovery, swapTxUuid } = state;
  switch (change.type) {
    case 'recoverSwap':
      if (
        !swapRecovery ||
        !isValidId(change.uuid) ||
        swapTxUuid !== change.uuid ||
        !isValidId(change.txId)
      )
        return current;
      if (state.status === 'submitted') {
        if (
          state.txId !== change.txId ||
          !change.sourceTxFailed ||
          state.sourceTxFailed
        )
          return current;
        return { ...current, state: { ...state, sourceTxFailed: true } };
      }
      if (state.status !== 'unknown' || state.txIdConflict) return current;
      return {
        ...current,
        state: {
          status: 'submitted',
          txId: change.txId,
          intentAmount,
          positionBefore,
          swapRecovery,
          swapTxUuid,
          ...(change.sourceTxFailed ? { sourceTxFailed: true as const } : {}),
        },
      };
    case 'submitted':
      if (attemptId !== change.attemptId || !isValidId(change.txId))
        return current;
      if (state.status === 'unknown') {
        return state.txIdConflict
          ? current
          : {
              ...current,
              state: {
                status: 'submitted',
                txId: change.txId,
                intentAmount,
                positionBefore,
                ...(swapRecovery ? { swapRecovery } : {}),
                ...(swapTxUuid ? { swapTxUuid } : {}),
              },
            };
      }
      return state.txId === change.txId
        ? current
        : {
            ...current,
            state: {
              status: 'unknown',
              txIdConflict: true,
              intentAmount,
              positionBefore,
              ...(swapRecovery ? { swapRecovery } : {}),
              ...(swapTxUuid ? { swapTxUuid } : {}),
            },
          };
    case 'settled':
      if (
        state.status !== 'submitted' ||
        state.sourceTxFailed ||
        state.txId !== change.txId ||
        !isValidAmount(change.receivedAmount)
      )
        return current;
      return {
        ...current,
        state: {
          status: 'funded',
          txId: state.txId,
          intentAmount,
          positionBefore,
          receivedAmount: change.receivedAmount,
        },
      };
    case 'cancelled':
      return attemptId === change.attemptId &&
        state.status === 'unknown' &&
        !state.txIdConflict
        ? undefined
        : current;
    case 'clear':
      return state.status === change.status && state.txId === change.txId
        ? undefined
        : current;
    case 'complete':
      if (
        current.source &&
        state.status === 'funded' &&
        state.txId === change.txId
      ) {
        return change.keepDestination
          ? { ...current, source: undefined }
          : undefined;
      }
      return current;
    default:
      throw new OneKeyLocalError('Invalid Earn funding change');
  }
}

function isReceiptClaimed(
  records: IFundingRecords | null | undefined,
  receipt: IEarnFundingReceipt,
) {
  return (
    records &&
    Object.values(records).some(
      (item) =>
        item.source?.scope === receipt.scope &&
        item.source.txId === receipt.txId,
    )
  );
}

export class SimpleDbEntityEarnFunding extends SimpleDbEntityBase<IFundingRecords> {
  entityName = 'earnFunding';

  override enableCache = false;

  @backgroundMethod()
  override async getRawData() {
    return withWebEntityLock(this.entityKey, () => super.getRawData());
  }

  @backgroundMethod()
  override async setRawData(
    data: Parameters<SimpleDbEntityBase<IFundingRecords>['setRawData']>[0],
  ) {
    return withWebEntityLock(this.entityKey, () => super.setRawData(data));
  }

  @backgroundMethod()
  override async clearRawData() {
    return withWebEntityLock(this.entityKey, () => super.clearRawData());
  }

  protected override enableUnreadableRecordSelfHeal = false;

  protected override rejectInvalidStoredData = true;

  protected override validateStoredData(data: unknown) {
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      !Object.values(data).every(isValidRecord)
    ) {
      throw new OneKeyLocalError('Invalid stored Earn funding state');
    }
  }

  async getFunding(scope: string) {
    return getFundingState(readRecord(await this.getRawData(), scope));
  }

  async changeFunding(scope: string, change: IEarnFundingChange) {
    if (
      !change ||
      ![
        'claim',
        'submitted',
        'settled',
        'cancelled',
        'clear',
        'complete',
      ].includes(change.type)
    ) {
      throw new OneKeyLocalError('Invalid Earn funding change');
    }
    return this.changeFundingInternal(scope, change);
  }

  async recoverSwapFunding(
    scope: string,
    uuid: string,
    txId: string,
    sourceTxFailed?: true,
  ) {
    return this.changeFundingInternal(scope, {
      type: 'recoverSwap',
      uuid,
      txId,
      sourceTxFailed,
    });
  }

  private async changeFundingInternal(scope: string, change: IFundingUpdate) {
    if (platformEnv.isWeb && !globalThis.navigator?.locks) {
      throw new OneKeyLocalError(
        'Earn funding requires cross-tab storage locking',
      );
    }
    if (!isValidId(scope, 2048) || !change || typeof change !== 'object') {
      throw new OneKeyLocalError('Invalid Earn funding scope or change');
    }
    const persist = async () => {
      let consumedScope: string | undefined;
      const { committed, data } = await this.setRawDataTransaction({
        shouldCommit: () => true,
        build: (records) => {
          const previous = readRecord(records, scope);
          if (
            change.type === 'claim' &&
            change.group !== undefined &&
            (!isValidId(change.group, 2048) ||
              Object.values(records ?? {}).some(
                (item) =>
                  item.group === change.group &&
                  (change.startsGroup || item.state.status !== 'funded'),
              ))
          )
            return undefined;
          if (change.type === 'claim' && change.source !== undefined) {
            if (!isValidReceipt(change.source)) return undefined;
            const sourceRecord = readRecord(records, change.source.scope);
            const sourceState = sourceRecord?.state;
            if (
              sourceState?.status !== 'funded' ||
              sourceState.txId !== change.source.txId ||
              sourceRecord?.source ||
              sourceRecord?.group !== change.group ||
              isReceiptClaimed(records, change.source)
            )
              return undefined;
          }
          if (
            change.type === 'clear' &&
            change.status === 'funded' &&
            isReceiptClaimed(records, { scope, txId: change.txId })
          )
            return undefined;
          const next = applyChange(previous, change);
          if (next === previous) return undefined;
          const updated = next ? { ...records, [scope]: next } : { ...records };
          if (change.type === 'complete') {
            const receipt = previous?.source;
            if (!receipt) return undefined;
            const sourceState = readRecord(records, receipt.scope)?.state;
            if (
              sourceState?.status !== 'funded' ||
              sourceState.txId !== receipt.txId
            )
              return undefined;
            delete updated[receipt.scope];
            consumedScope = receipt.scope;
          }
          if (!next) delete updated[scope];
          return { data: updated };
        },
      });
      return {
        applied: committed,
        funding: getFundingState(readRecord(data, scope)),
        consumedScope: committed ? consumedScope : undefined,
      };
    };

    // Browser tabs can each own a standalone background. Serialize those
    // writers as well as the multiple windows served by one background.
    return withWebEntityLock(this.entityKey, persist);
  }
}
