import { createPrimeCheckoutHandoff } from './primeCheckoutHandoff';

const state = {
  checkoutId: 'modal',
  attemptId: 'attempt',
  revision: 1,
  canSwitch: true,
};
const fallback = {
  ...state,
  trigger: 'userRequestedHostedCheckout',
  requestId: 'confirm',
};
const create = () => createPrimeCheckoutHandoff('modal', jest.fn());

it('waits for the current form, confirms once, and consumes one handoff only', () => {
  const handoff = create();
  expect(handoff.beginConfirmation('confirm')).toBe(false);
  handoff.receiveState(state);
  expect(handoff.acceptFallback(fallback)).toBe(false);
  expect(handoff.beginConfirmation('confirm')).toBe(true);
  expect(handoff.beginConfirmation('duplicate')).toBe(false);
  expect(handoff.confirm('confirm')).toMatchObject({
    checkoutId: 'modal',
    attemptId: 'attempt',
    requestId: 'confirm',
  });
  expect(handoff.confirm('confirm')).toBeUndefined();
  expect(handoff.acceptFallback({ ...fallback, requestId: 'other' })).toBe(
    false,
  );
  expect(handoff.acceptFallback(fallback)).toBe(true);
  expect(handoff.acceptFallback(fallback)).toBe(false);
});

it('keeps the form available when the confirmation is cancelled', () => {
  const handoff = create();
  handoff.receiveState(state);
  handoff.beginConfirmation('confirm');
  handoff.dismissConfirmation('confirm');
  expect(handoff.canSwitch()).toBe(true);
  expect(handoff.confirm('confirm')).toBeUndefined();
  expect(handoff.acceptFallback(fallback)).toBe(false);
});

it('rejects stale confirmation after submission or completion, including out-of-order ready messages', () => {
  const handoff = create();
  handoff.receiveState(state);
  handoff.beginConfirmation('confirm');
  handoff.receiveState({ ...state, revision: 3, canSwitch: false });
  handoff.receiveState({ ...state, revision: 2 });
  expect(handoff.canSwitch()).toBe(false);
  expect(handoff.confirm('confirm')).toBeUndefined();
  expect(handoff.acceptFallback(fallback)).toBe(false);
});

it('allows another confirmation only when the SDK reports an ignored cancellation', () => {
  const handoff = create();
  handoff.receiveState(state);
  handoff.beginConfirmation('confirm');
  handoff.confirm('confirm');
  expect(handoff.canSwitch()).toBe(false);
  handoff.receiveState({
    ...state,
    revision: 2,
    requestId: 'confirm',
    cancelled: false,
  });
  expect(handoff.canSwitch()).toBe(true);
  expect(handoff.acceptFallback(fallback)).toBe(false);
});

it.each(['close', 'unmount', 'navigation', 'account change'])(
  'ignores late messages after %s, and isolates a reopened checkout',
  () => {
    const old = create();
    old.receiveState(state);
    old.beginConfirmation('confirm');
    old.confirm('confirm');
    old.invalidate();
    old.receiveState({ ...state, revision: 2 });
    expect(old.canSwitch()).toBe(false);
    expect(old.acceptFallback(fallback)).toBe(false);
    const reopened = createPrimeCheckoutHandoff('new-modal', jest.fn());
    reopened.receiveState(state);
    expect(reopened.canSwitch()).toBe(false);
    expect(reopened.acceptFallback(fallback)).toBe(false);
  },
);

it('ignores other instances and attempts, while preserving one automatic fallback', () => {
  const handoff = create();
  handoff.receiveState({ ...state, checkoutId: 'other' });
  expect(handoff.canSwitch()).toBe(false);
  handoff.receiveState(state);
  handoff.receiveState({
    ...state,
    attemptId: 'late-attempt',
    revision: 3,
    canSwitch: false,
  });
  expect(handoff.canSwitch()).toBe(true);
  expect(
    handoff.acceptFallback({ ...fallback, attemptId: 'late-attempt' }),
  ).toBe(false);
  expect(
    handoff.acceptFallback({ ...fallback, trigger: 'checkoutError' }),
  ).toBe(true);
  expect(
    handoff.acceptFallback({ ...fallback, trigger: 'checkoutError' }),
  ).toBe(false);
});
