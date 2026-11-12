import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createBorrowLutTaskRegistry } from './borrowLutTaskRegistry';

const createController = (accountId: string, amount: string) => ({
  getTask: () => ({ accountId, amount }),
});
type IController = ReturnType<typeof createController>;

describe('Borrow LUT task registry', () => {
  it('does not expose or release a same-address task to another account owner', () => {
    const registry = createBorrowLutTaskRegistry<IController>();
    const owner = {
      accountId: 'account-a',
      networkId: 'sol--101',
      accountAddress: 'AddressA',
    };
    const other = { ...owner, accountId: 'account-b' };
    const first = registry.reserve(owner, createController('account-a', '1'));
    if (first.type !== 'reserved')
      throw new OneKeyLocalError('expected reservation');
    expect(registry.findReservation(other)).toEqual({ type: 'conflict' });
    expect(registry.find(other)).toBeUndefined();
    expect(registry.reserve(other, createController('account-b', '2'))).toEqual(
      { type: 'conflict' },
    );
    expect(registry.release(other, first.token)).toBe(false);
    expect(
      registry.replace(other, first.token, createController('account-b', '2')),
    ).toBeUndefined();
    expect(registry.findReservation(owner)).toEqual({
      type: 'owned',
      controller: expect.anything(),
      token: first.token,
    });
  });
  it('atomically retains one controller for the same network and address despite different accounts or amounts', async () => {
    const registry = createBorrowLutTaskRegistry<IController>();
    const identity = {
      accountId: 'account-a',
      networkId: 'sol--101',
      accountAddress: 'AddressA',
    };
    const other = { ...identity, accountId: 'account-b' };
    const first = createController('account-a', '1');
    const second = createController('account-b', '2');
    const [a, b] = await Promise.all([
      Promise.resolve().then(() => registry.reserve(identity, first)),
      Promise.resolve().then(() => registry.reserve(other, second)),
    ]);
    expect(a.type).toBe('reserved');
    expect(b).toEqual({ type: 'conflict' });
    expect(registry.find(identity)).toBe(first);
  });

  it('uses chain-aware normalization and keeps different networks and addresses separate', () => {
    const registry = createBorrowLutTaskRegistry<IController>();
    const controller = createController('a', '1');
    expect(
      registry.reserve(
        { accountId: 'a', networkId: 'evm--1', accountAddress: '0xAbC' },
        controller,
      ).type,
    ).toBe('reserved');
    expect(
      registry.reserve(
        { accountId: 'a', networkId: 'evm--1', accountAddress: '0xabc' },
        controller,
      ).type,
    ).toBe('conflict');
    expect(
      registry.reserve(
        { accountId: 'a', networkId: 'evm--2', accountAddress: '0xabc' },
        controller,
      ).type,
    ).toBe('reserved');
    expect(
      registry.reserve(
        { accountId: 'a', networkId: 'sol--101', accountAddress: 'AbC' },
        controller,
      ).type,
    ).toBe('reserved');
    expect(
      registry.reserve(
        { accountId: 'a', networkId: 'sol--101', accountAddress: 'abc' },
        controller,
      ).type,
    ).toBe('reserved');
  });

  it('releases only the current reservation token, including after replacement', () => {
    const registry = createBorrowLutTaskRegistry<IController>();
    const identity = {
      accountId: 'a',
      networkId: 'sol--101',
      accountAddress: 'AddressA',
    };
    const first = registry.reserve(identity, createController('a', '1'));
    if (first.type !== 'reserved')
      throw new OneKeyLocalError('expected reservation');
    expect(registry.release(identity, Symbol('other'))).toBe(false);
    expect(registry.release(identity, first.token)).toBe(true);
    const nextController = createController('a', '2');
    const second = registry.reserve(identity, nextController);
    if (second.type !== 'reserved')
      throw new OneKeyLocalError('expected reservation');
    expect(registry.release(identity, first.token)).toBe(false);
    expect(registry.find(identity)).toBe(nextController);
    expect(registry.release(identity, second.token)).toBe(true);
    expect(registry.find(identity)).toBeUndefined();
  });

  it('rejects missing or untrimmed identities instead of sharing an ambiguous key', () => {
    const registry = createBorrowLutTaskRegistry<IController>();
    const controller = createController('a', '1');
    expect(() =>
      registry.reserve(
        { accountId: '', networkId: 'sol--101', accountAddress: 'address' },
        controller,
      ),
    ).toThrow();
    expect(() =>
      registry.reserve(
        { accountId: 'a', networkId: '', accountAddress: 'address' },
        controller,
      ),
    ).toThrow();
    expect(() =>
      registry.reserve(
        { accountId: 'a', networkId: 'sol--101', accountAddress: '' },
        controller,
      ),
    ).toThrow();
    expect(() =>
      registry.reserve(
        { accountId: 'a', networkId: 'sol--101', accountAddress: ' address ' },
        controller,
      ),
    ).toThrow();
  });

  it('hands ownership to a new intent atomically and invalidates the previous token', () => {
    const registry = createBorrowLutTaskRegistry<IController>();
    const owner = {
      accountId: 'a',
      networkId: 'sol--101',
      accountAddress: 'AddressA',
    };
    const oldController = createController('a', '1');
    const nextController = createController('a', '2');
    const first = registry.reserve(owner, oldController);
    if (first.type !== 'reserved')
      throw new OneKeyLocalError('expected reservation');
    expect(
      registry.replace(owner, Symbol('other'), nextController),
    ).toBeUndefined();
    expect(registry.find(owner)).toBe(oldController);
    const nextToken = registry.replace(owner, first.token, nextController);
    expect(nextToken).toBeDefined();
    expect(registry.find(owner)).toBe(nextController);
    expect(registry.release(owner, first.token)).toBe(false);
    expect(registry.reserve(owner, oldController)).toEqual({
      type: 'conflict',
    });
    if (!nextToken) throw new OneKeyLocalError('expected replacement');
    expect(registry.release(owner, nextToken)).toBe(true);
  });
});
