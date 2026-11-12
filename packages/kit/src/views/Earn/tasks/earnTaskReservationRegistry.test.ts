import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnTaskReservationRegistry } from './earnTaskReservationRegistry';

it('retains the original task and only its reservation owner can release it', () => {
  const registry = createEarnTaskReservationRegistry<string, { id: string }>();
  const task = { id: 'task' };
  const owner = registry.reserve('account-asset', task);
  expect(owner).toBeDefined();
  expect(
    registry.reserve('account-asset', { id: 'duplicate' }),
  ).toBeUndefined();
  expect(registry.find('account-asset')?.controller).toBe(task);
  expect(registry.release('account-asset', Symbol('other'))).toBe(false);
  if (!owner) throw new OneKeyLocalError('Missing reservation');
  expect(registry.release('account-asset', owner)).toBe(true);
  expect(registry.find('account-asset')).toBeUndefined();
});

it('serializes recovery and rejects stale owners and leases', () => {
  const registry = createEarnTaskReservationRegistry<string, object>();
  const owner = registry.reserve('key', {});
  if (!owner) throw new OneKeyLocalError('Missing reservation');
  const lease = registry.acquireRecovery('key', owner);
  if (!lease) throw new OneKeyLocalError('Missing recovery lease');
  expect(registry.acquireRecovery('key', owner)).toBeUndefined();
  expect(registry.releaseRecovery('key', owner, Symbol('stale'))).toBe(false);
  expect(registry.releaseRecovery('key', Symbol('stale'), lease)).toBe(false);
  expect(registry.releaseRecovery('key', owner, lease)).toBe(true);
  const next = registry.acquireRecovery('key', owner);
  expect(next).toBeDefined();
  expect(registry.release('key', owner)).toBe(true);
  const replacement = registry.reserve('key', {});
  if (!replacement) throw new OneKeyLocalError('Missing replacement');
  expect(registry.release('key', owner)).toBe(false);
  expect(registry.releaseRecovery('key', replacement, lease)).toBe(false);
});
