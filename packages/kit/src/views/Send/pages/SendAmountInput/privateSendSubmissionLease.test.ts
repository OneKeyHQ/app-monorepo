import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  PrivateSendSubmissionLeaseCoordinator,
  createPrivateSendCreatedOrderLifecycle,
  runPrivateSendOrderBuild,
} from './privateSendSubmissionLease';

describe('PrivateSendSubmissionLeaseCoordinator', () => {
  it('grants only one synchronous lease for same-tick double submit', () => {
    const coordinator = new PrivateSendSubmissionLeaseCoordinator();

    expect(coordinator.acquire('scope-1')).toBeDefined();
    expect(coordinator.acquire('scope-1')).toBeUndefined();
  });

  it('blocks order creation when validation resumes under another scope', () => {
    const coordinator = new PrivateSendSubmissionLeaseCoordinator();
    const lease = coordinator.acquire('scope-1')!;

    expect(coordinator.markBuilding(lease, 'scope-2')).toBe(false);
  });

  it('continues an already-created order from its frozen lease after live scope changes', () => {
    const coordinator = new PrivateSendSubmissionLeaseCoordinator();
    const lease = coordinator.acquire('scope-1')!;

    expect(coordinator.markBuilding(lease, 'scope-1')).toBe(true);
    expect(coordinator.markOrderCreated(lease)).toBe(true);
    expect(coordinator.isPreBuildOwner(lease, 'scope-2')).toBe(false);
    expect(coordinator.shouldContinueCreatedOrder(lease)).toBe(true);
  });

  it('releases a pre-order failure so the same scope can retry', () => {
    const coordinator = new PrivateSendSubmissionLeaseCoordinator();
    const lease = coordinator.acquire('scope-1')!;

    expect(coordinator.releasePreOrderFailure(lease)).toBe(true);
    expect(coordinator.acquire('scope-1')).toBeDefined();
  });

  it('keeps a terminal lock after a created order fails a post-create invariant', () => {
    const coordinator = new PrivateSendSubmissionLeaseCoordinator();
    const lease = coordinator.acquire('scope-1')!;

    expect(coordinator.markBuilding(lease, 'scope-1')).toBe(true);
    expect(coordinator.markOrderCreated(lease)).toBe(true);
    expect(coordinator.markPostCreateFailure(lease)).toBe(true);
    expect(coordinator.releasePreOrderFailure(lease)).toBe(false);
    expect(coordinator.hasPostCreateFailure()).toBe(true);
    expect(coordinator.acquire('scope-1')).toBeUndefined();
  });

  it('does not build a second provider order after post-create validation fails', async () => {
    const coordinator = new PrivateSendSubmissionLeaseCoordinator();
    const buildOrder = jest.fn(async () => ({ payinAddress: '' }));

    const submit = async () => {
      const lease = coordinator.acquire('scope-1');
      if (!lease) return;
      try {
        await runPrivateSendOrderBuild({
          coordinator,
          lease,
          liveScopeKey: 'scope-1',
          build: buildOrder,
          validate: (order) => {
            if (!order.payinAddress) {
              throw new OneKeyLocalError('invalid payin address');
            }
            return order;
          },
        });
      } catch {
        // The container surfaces this as a localized non-retry error.
      } finally {
        coordinator.releasePreOrderFailure(lease);
      }
    };

    await submit();
    await submit();

    expect(buildOrder).toHaveBeenCalledTimes(1);
    expect(coordinator.hasPostCreateFailure()).toBe(true);
  });

  it('keeps a terminal lock when the build response has an ambiguous outcome', async () => {
    const coordinator = new PrivateSendSubmissionLeaseCoordinator();
    const lease = coordinator.acquire('scope-1')!;

    await expect(
      runPrivateSendOrderBuild({
        coordinator,
        lease,
        liveScopeKey: 'scope-1',
        build: async () => {
          throw new OneKeyLocalError('response lost');
        },
        validate: (order) => order,
      }),
    ).rejects.toThrow('response lost');

    expect(coordinator.hasPostCreateFailure()).toBe(true);
    expect(coordinator.releasePreOrderFailure(lease)).toBe(false);
    expect(coordinator.acquire('scope-1')).toBeUndefined();
  });

  it('releases the lease after a created order enters the send flow', () => {
    const coordinator = new PrivateSendSubmissionLeaseCoordinator();
    const lease = coordinator.acquire('scope-1')!;

    expect(coordinator.markBuilding(lease, 'scope-1')).toBe(true);
    expect(coordinator.markOrderCreated(lease)).toBe(true);
    expect(coordinator.completeCreatedOrder(lease)).toBe(true);
    expect(coordinator.acquire('scope-1')).toBeDefined();
  });

  it.each(['failed', 'cancelled'] as const)(
    'keeps the created-order lock when tx confirmation is %s',
    async (outcome) => {
      const coordinator = new PrivateSendSubmissionLeaseCoordinator();
      const buildOrder = jest.fn(async () => ({ orderId: 'order-1' }));
      const lease = coordinator.acquire('scope-1')!;

      await runPrivateSendOrderBuild({
        coordinator,
        lease,
        liveScopeKey: 'scope-1',
        build: buildOrder,
        validate: (order) => order,
      });
      const lifecycle = createPrivateSendCreatedOrderLifecycle({
        coordinator,
        lease,
        onPostCreateFailure: jest.fn(),
      });

      // navigationToTxConfirm resolves as soon as it pushes the confirmation
      // screen; that alone must not release the created external order.
      expect(coordinator.acquire('scope-1')).toBeUndefined();
      if (outcome === 'failed') {
        lifecycle.onFail(new Error('sign failed'));
      } else {
        lifecycle.onCancel();
      }
      expect(coordinator.acquire('scope-1')).toBeUndefined();
      expect(buildOrder).toHaveBeenCalledTimes(1);
    },
  );

  it('releases a created-order lock only after tx confirmation succeeds', async () => {
    const coordinator = new PrivateSendSubmissionLeaseCoordinator();
    const lease = coordinator.acquire('scope-1')!;

    await runPrivateSendOrderBuild({
      coordinator,
      lease,
      liveScopeKey: 'scope-1',
      build: async () => ({ orderId: 'order-1' }),
      validate: (order) => order,
    });
    const lifecycle = createPrivateSendCreatedOrderLifecycle({
      coordinator,
      lease,
      onPostCreateFailure: jest.fn(),
    });

    expect(coordinator.acquire('scope-1')).toBeUndefined();
    await lifecycle.onSuccess(undefined);
    expect(coordinator.acquire('scope-1')).toBeDefined();
  });

  it('fails closed when the provider order arrives from an unexpected local phase', () => {
    const coordinator = new PrivateSendSubmissionLeaseCoordinator();
    const lease = coordinator.acquire('scope-1')!;

    expect(coordinator.markOrderCreated(lease)).toBe(false);
    expect(coordinator.hasPostCreateFailure()).toBe(true);
    expect(coordinator.releasePreOrderFailure(lease)).toBe(false);
    expect(coordinator.acquire('scope-1')).toBeUndefined();
  });
});
