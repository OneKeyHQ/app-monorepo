import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEtherFiDepositRecovery } from './etherFiDepositRecovery';

const scope = {
  accountId: 'account-1',
  accountAddress: '0x1111111111111111111111111111111111111111',
  networkId: 'evm--1',
  vault: '0xf0bb20865277abd641a307ece5ee04e79073416c',
};
const firstTx = `0x${'a'.repeat(64)}`;
const secondTx = `0x${'b'.repeat(64)}`;

describe('EtherFi deposit recovery', () => {
  it('retains an uncertain submitted step after the originating form detaches', () => {
    const recovery = createEtherFiDepositRecovery();
    const operation = recovery.begin(scope, '0.1', 'wrap');
    recovery.markSending(operation, operation, 'wrap');
    recovery.detach(operation, operation);
    expect(recovery.list(scope)).toEqual([
      expect.objectContaining({
        amount: '0.1',
        phase: 'wrap',
        status: 'unknown',
      }),
    ]);
  });

  it('exposes an attached pending step to other forms without offering it for recovery', () => {
    const recovery = createEtherFiDepositRecovery();
    const operation = recovery.begin(scope, '0.1', 'wrap');
    recovery.markSending(operation, operation, 'wrap');
    expect(recovery.list(scope)).toEqual([]);
    expect(recovery.list(scope, true)).toEqual([
      expect.objectContaining({
        id: operation,
        status: 'unknown',
        detached: false,
      }),
    ]);
  });

  it('only offers continuation after a confirmed wrap, and isolates accounts', () => {
    const recovery = createEtherFiDepositRecovery();
    const operation = recovery.begin(scope, '0.1', 'wrap');
    const attempt = recovery.markSending(operation, operation, 'wrap');
    if (!attempt) throw new OneKeyLocalError('Missing attempt');
    recovery.recordTxid(operation, attempt, firstTx);
    recovery.detach(operation, operation);
    expect(recovery.list(scope)[0].status).toBe('confirming');
    expect(recovery.list({ ...scope, accountId: 'account-2' })).toHaveLength(0);
    recovery.recordFinal(operation, attempt, firstTx, 'success');
    expect(recovery.list(scope)[0]).toEqual(
      expect.objectContaining({ status: 'ready', phase: 'wrap' }),
    );
  });

  it('does not let a stale transaction result change a later step or another operation', () => {
    const recovery = createEtherFiDepositRecovery();
    const first = recovery.begin(scope, '0.1', 'wrap');
    const second = recovery.begin(scope, '0.2', 'wrap');
    const firstAttempt = recovery.markSending(first, first, 'wrap');
    if (!firstAttempt) throw new OneKeyLocalError('Missing attempt');
    recovery.recordTxid(first, firstAttempt, firstTx);
    recovery.recordFinal(first, firstAttempt, firstTx, 'success');
    recovery.advance(first, first, 'approve');
    expect(recovery.markSending(first, first, 'wrap')).toBeUndefined();
    const secondAttempt = recovery.markSending(first, first, 'approve');
    if (!secondAttempt) throw new OneKeyLocalError('Missing attempt');
    recovery.recordTxid(first, secondAttempt, secondTx);
    recovery.recordFinal(first, firstAttempt, firstTx, 'success');
    recovery.detach(first, first);
    recovery.detach(second, second);
    expect(recovery.list(scope)).toEqual([
      expect.objectContaining({
        amount: '0.1',
        phase: 'approve',
        status: 'confirming',
        txid: secondTx,
      }),
    ]);
  });

  it('does not retain an operation cancelled before any transaction starts', () => {
    const recovery = createEtherFiDepositRecovery();
    const operation = recovery.begin(scope, '0.1', 'wrap');
    recovery.detach(operation, operation);
    expect(recovery.list(scope)).toEqual([]);
  });

  it('retains the completed wrap when the next step is cancelled before sending', () => {
    const recovery = createEtherFiDepositRecovery();
    const operation = recovery.begin(scope, '0.1', 'wrap');
    const attempt = recovery.markSending(operation, operation, 'wrap');
    if (!attempt) throw new OneKeyLocalError('Missing attempt');
    recovery.recordTxid(operation, attempt, firstTx);
    recovery.recordFinal(operation, attempt, firstTx, 'success');
    recovery.advance(operation, operation, 'approve');
    recovery.detach(operation, operation);
    expect(recovery.list(scope)[0]).toEqual(
      expect.objectContaining({ phase: 'wrap', status: 'ready' }),
    );
  });

  it('does not retry an unknown attempt or accept a malformed transaction id', () => {
    const recovery = createEtherFiDepositRecovery();
    const operation = recovery.begin(scope, '0.1', 'wrap');
    const attempt = recovery.markSending(operation, operation, 'wrap');
    if (!attempt) throw new OneKeyLocalError('Missing attempt');
    expect(recovery.markSending(operation, operation, 'wrap')).toBeUndefined();
    recovery.recordTxid(operation, attempt, '0xinvalid');
    recovery.detach(operation, operation);
    expect(recovery.list(scope)[0].status).toBe('unknown');
    expect(recovery.prepareRetry(operation, operation)).toBe(false);
  });

  it('retries only a confirmed failed approval without wrapping again', () => {
    const recovery = createEtherFiDepositRecovery();
    const operation = recovery.begin(scope, '0.1', 'wrap');
    const wrapAttempt = recovery.markSending(operation, operation, 'wrap');
    if (!wrapAttempt) throw new OneKeyLocalError('Missing attempt');
    recovery.recordTxid(operation, wrapAttempt, firstTx);
    recovery.recordFinal(operation, wrapAttempt, firstTx, 'success');
    recovery.advance(operation, operation, 'approve');
    const approveAttempt = recovery.markSending(
      operation,
      operation,
      'approve',
    );
    if (!approveAttempt) throw new OneKeyLocalError('Missing attempt');
    recovery.recordTxid(operation, approveAttempt, secondTx);
    recovery.recordFinal(operation, approveAttempt, secondTx, 'failed');
    expect(recovery.prepareRetry(operation, operation)).toBe(true);
    const retryAttempt = recovery.markSending(operation, operation, 'approve');
    expect(retryAttempt).toBeDefined();
    recovery.recordFinal(operation, approveAttempt, secondTx, 'success');
    recovery.detach(operation, operation);
    expect(recovery.list(scope)[0]).toEqual(
      expect.objectContaining({
        phase: 'approve',
        status: 'unknown',
        completedPhases: ['wrap'],
      }),
    );
  });

  it('allows only one form to take ownership of a retained operation', () => {
    const recovery = createEtherFiDepositRecovery();
    const operation = recovery.begin(scope, '0.1', 'wrap');
    const attempt = recovery.markSending(operation, operation, 'wrap');
    if (!attempt) throw new OneKeyLocalError('Missing attempt');
    recovery.recordTxid(operation, attempt, firstTx);
    recovery.recordFinal(operation, attempt, firstTx, 'success');
    recovery.detach(operation, operation);
    const owner = recovery.claim(operation);
    expect(owner).toBeDefined();
    if (!owner) throw new OneKeyLocalError('Missing owner');
    expect(recovery.claim(operation)).toBeUndefined();
    expect(recovery.advance(operation, operation, 'approve')).toBe(false);
    expect(recovery.advance(operation, owner, 'approve')).toBe(true);
  });

  it('keeps a separately initiated operation isolated from an unknown one', () => {
    const recovery = createEtherFiDepositRecovery();
    const first = recovery.begin(scope, '0.1', 'wrap');
    const firstAttempt = recovery.markSending(first, first, 'wrap');
    if (!firstAttempt) throw new OneKeyLocalError('Missing attempt');
    recovery.detach(first, first);
    const second = recovery.begin(scope, '0.2', 'wrap');
    const secondAttempt = recovery.markSending(second, second, 'wrap');
    if (!secondAttempt) throw new OneKeyLocalError('Missing attempt');
    recovery.recordTxid(second, secondAttempt, secondTx);
    recovery.recordFinal(second, secondAttempt, secondTx, 'success');
    recovery.detach(second, second);
    recovery.recordTxid(first, firstAttempt, firstTx);
    expect(recovery.list(scope)).toEqual([
      expect.objectContaining({
        amount: '0.1',
        status: 'confirming',
        txid: firstTx,
      }),
      expect.objectContaining({
        amount: '0.2',
        status: 'ready',
        txid: secondTx,
      }),
    ]);
  });

  it('does not assign a transaction hash to two independent intents', () => {
    const recovery = createEtherFiDepositRecovery();
    const first = recovery.begin(scope, '0.1', 'wrap');
    const second = recovery.begin(scope, '0.1', 'wrap');
    const firstAttempt = recovery.markSending(first, first, 'wrap');
    const secondAttempt = recovery.markSending(second, second, 'wrap');
    if (!firstAttempt || !secondAttempt)
      throw new OneKeyLocalError('Missing attempt');
    expect(recovery.recordTxid(first, firstAttempt, firstTx)).toBe(true);
    expect(
      recovery.recordTxid(
        second,
        secondAttempt,
        firstTx.toUpperCase().replace('0X', '0x'),
      ),
    ).toBe(false);
    recovery.detach(second, second);
    expect(recovery.list(scope)[0].status).toBe('unknown');
  });

  it('rejects non-native vaults, invalid accounts, networks and amounts', () => {
    const recovery = createEtherFiDepositRecovery();
    expect(() =>
      recovery.begin(
        { ...scope, vault: '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c' },
        '1',
        'wrap',
      ),
    ).toThrow();
    expect(() =>
      recovery.begin({ ...scope, networkId: 'evm--10' }, '1', 'wrap'),
    ).toThrow();
    expect(() =>
      recovery.begin({ ...scope, accountAddress: 'bad' }, '1', 'wrap'),
    ).toThrow();
    expect(() =>
      recovery.begin(scope, '0.0000000000000000001', 'wrap'),
    ).toThrow();
  });
});
