import BigNumber from 'bignumber.js';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { getEtherFiVaultConfig } from '@onekeyhq/shared/src/utils/etherFiVaults';

export type IEtherFiDepositRecoveryScope = {
  accountId: string;
  accountAddress: string;
  networkId: string;
  vault: string;
};

type IPhase = 'wrap' | 'approve' | 'deposit';
type IStatus =
  | 'preparing'
  | 'unknown'
  | 'confirming'
  | 'ready'
  | 'failed'
  | 'completed';

export type IEtherFiDepositRecovery = {
  id: symbol;
  renderKey: number;
  scope: IEtherFiDepositRecoveryScope;
  amount: string;
  phase: IPhase;
  status: IStatus;
  txid?: string;
  attemptId?: symbol;
  completedPhases: IPhase[];
  detached: boolean;
  owner: symbol;
};

function scopeKey(scope: IEtherFiDepositRecoveryScope) {
  return JSON.stringify([
    scope.accountId,
    scope.accountAddress.toLowerCase(),
    scope.networkId,
    scope.vault.toLowerCase(),
  ]);
}

export function createEtherFiDepositRecovery() {
  const records = new Map<symbol, IEtherFiDepositRecovery>();
  let nextRenderKey = 0;
  const usedTxids = new Set<string>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const update = (
    id: symbol,
    fn: (record: IEtherFiDepositRecovery) => IEtherFiDepositRecovery,
  ) => {
    const record = records.get(id);
    if (!record) return;
    const next = fn(record);
    if (next === record) return;
    records.set(id, next);
    emit();
  };
  return {
    begin(scope: IEtherFiDepositRecoveryScope, amount: string, phase: IPhase) {
      const config = /^0x[0-9a-f]{40}$/i.test(scope.vault)
        ? getEtherFiVaultConfig(scope.vault)
        : undefined;
      const amountBN = new BigNumber(amount);
      if (
        !scope.accountId ||
        !/^0x[0-9a-f]{40}$/i.test(scope.accountAddress) ||
        scope.networkId !== getNetworkIdsMap().eth ||
        !config ||
        !config.inputs.some(
          (asset) => asset.symbol === 'ETH' && !asset.address,
        ) ||
        !config.inputs.some(
          (asset) =>
            asset.address?.toLowerCase() === EthereumWETH.toLowerCase() &&
            asset.decimals === 18,
        ) ||
        !amountBN.isFinite() ||
        amountBN.lte(0) ||
        !amountBN.shiftedBy(18).isInteger() ||
        phase !== 'wrap'
      ) {
        throw new OneKeyLocalError(
          'Invalid EtherFi native deposit recovery intent',
        );
      }
      const id = Symbol('etherFiDepositOperation');
      nextRenderKey += 1;
      records.set(id, {
        id,
        renderKey: nextRenderKey,
        scope: { ...scope },
        amount,
        phase,
        status: 'preparing',
        completedPhases: [],
        detached: false,
        owner: id,
      });
      emit();
      return id;
    },
    markSending(id: symbol, owner: symbol, phase: IPhase) {
      const record = records.get(id);
      if (
        !record ||
        record.owner !== owner ||
        record.detached ||
        record.phase !== phase ||
        record.status !== 'preparing'
      )
        return undefined;
      const attemptId = Symbol('etherFiDepositAttempt');
      update(id, (current) => ({ ...current, status: 'unknown', attemptId }));
      return attemptId;
    },
    recordTxid(id: symbol, attemptId: symbol, txid: string) {
      const record = records.get(id);
      if (
        !record ||
        record.status !== 'unknown' ||
        record.attemptId !== attemptId ||
        !/^0x[0-9a-f]{64}$/i.test(txid)
      )
        return false;
      const normalizedTxid = txid.toLowerCase();
      const key = `${record.scope.networkId}|${normalizedTxid}`;
      if (usedTxids.has(key)) return false;
      usedTxids.add(key);
      update(id, (current) => ({
        ...current,
        status: 'confirming',
        txid: normalizedTxid,
      }));
      return true;
    },
    recordFinal(
      id: symbol,
      attemptId: symbol,
      txid: string,
      result: 'success' | 'failed',
    ) {
      update(id, (record) => {
        if (
          record.status !== 'confirming' ||
          record.attemptId !== attemptId ||
          record.txid !== txid.toLowerCase()
        )
          return record;
        if (result === 'failed') return { ...record, status: 'failed' };
        return {
          ...record,
          status: record.phase === 'deposit' ? 'completed' : 'ready',
          completedPhases: [...record.completedPhases, record.phase],
        };
      });
    },
    prepareRetry(id: symbol, owner: symbol) {
      const record = records.get(id);
      if (
        !record ||
        record.owner !== owner ||
        record.detached ||
        record.status !== 'failed'
      )
        return false;
      update(id, (current) => ({
        ...current,
        status: 'preparing',
        attemptId: undefined,
        txid: undefined,
      }));
      return true;
    },
    advance(id: symbol, owner: symbol, phase: IPhase) {
      const record = records.get(id);
      if (
        !record ||
        record.owner !== owner ||
        record.detached ||
        record.status !== 'ready' ||
        !(
          (record.phase === 'wrap' &&
            (phase === 'approve' || phase === 'deposit')) ||
          (record.phase === 'approve' && phase === 'deposit')
        )
      )
        return false;
      update(id, (current) => ({
        ...current,
        phase,
        status: 'preparing',
        txid: undefined,
        attemptId: undefined,
      }));
      return true;
    },
    replanUnsent(id: symbol, owner: symbol, phase: 'approve' | 'deposit') {
      const record = records.get(id);
      if (
        !record ||
        record.owner !== owner ||
        record.detached ||
        record.status !== 'preparing' ||
        record.attemptId ||
        !record.completedPhases.includes('wrap') ||
        !['approve', 'deposit'].includes(record.phase)
      )
        return false;
      update(id, (current) => ({ ...current, phase }));
      return true;
    },
    detach(id: symbol, owner: symbol) {
      const record = records.get(id);
      if (!record || record.owner !== owner) return;
      if (record.status === 'preparing') {
        const previous =
          record.completedPhases[record.completedPhases.length - 1];
        if (!previous) {
          records.delete(id);
          emit();
        } else {
          update(id, (current) => ({
            ...current,
            phase: previous,
            status: 'ready',
            detached: true,
          }));
        }
        return;
      }
      update(id, (current) =>
        current.detached ? current : { ...current, detached: true },
      );
    },
    claim(id: symbol) {
      const record = records.get(id);
      if (
        !record ||
        !record.detached ||
        (record.status !== 'ready' && record.status !== 'failed')
      )
        return undefined;
      const owner = Symbol('etherFiDepositOwner');
      update(id, (current) => ({ ...current, detached: false, owner }));
      return owner;
    },
    dismissCompleted(id: symbol) {
      const record = records.get(id);
      if (!record || !record.detached || record.status !== 'completed')
        return false;
      records.delete(id);
      emit();
      return true;
    },
    dismissFailedWrap(id: symbol) {
      const record = records.get(id);
      if (
        !record ||
        !record.detached ||
        record.status !== 'failed' ||
        record.phase !== 'wrap'
      )
        return false;
      records.delete(id);
      emit();
      return true;
    },
    list(scope: IEtherFiDepositRecoveryScope, includeAttached = false) {
      const key = scopeKey(scope);
      return Array.from(records.values())
        .filter(
          (record) =>
            (includeAttached || record.detached) &&
            scopeKey(record.scope) === key,
        )
        .map((record) => ({
          ...record,
          scope: { ...record.scope },
          completedPhases: [...record.completedPhases],
        }));
    },
    get(id: symbol) {
      const record = records.get(id);
      return record
        ? {
            ...record,
            scope: { ...record.scope },
            completedPhases: [...record.completedPhases],
          }
        : undefined;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const etherFiDepositRecovery = createEtherFiDepositRecovery();
