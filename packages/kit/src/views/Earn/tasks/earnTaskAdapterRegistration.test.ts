import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnTaskAdapterRegistration } from './earnTaskAdapterRegistration';

test('registers an adapter before navigation is finished without waiting for navigation', async () => {
  const registration = createEarnTaskAdapterRegistration<{
    prepare: () => void;
  }>();
  const controller = new AbortController();
  const waiting = registration.wait(controller.signal);
  const adapter = { prepare: jest.fn() };
  expect(registration.register(adapter)).toBe(true);
  await expect(waiting).resolves.toBe(adapter);
  expect(registration.register(adapter)).toBe(false);
});

test('releases an aborted waiter and refuses a later adapter', async () => {
  const registration = createEarnTaskAdapterRegistration<{
    prepare: () => void;
  }>();
  const controller = new AbortController();
  const waiting = registration.wait(controller.signal);
  controller.abort();
  await expect(waiting).resolves.toBeUndefined();
  expect(registration.register({ prepare: jest.fn() })).toBe(false);
});

test('propagates a preparation failure without registering an adapter', async () => {
  const registration = createEarnTaskAdapterRegistration<{
    prepare: () => void;
  }>();
  const controller = new AbortController();
  const waiting = registration.wait(controller.signal);
  const error = new OneKeyLocalError('preflight failed');
  registration.fail(error);
  await expect(waiting).rejects.toBe(error);
  expect(registration.register({ prepare: jest.fn() })).toBe(false);
});
