/** @jest-environment jsdom */

import { createPrimeEmbeddedCheckoutSession } from './primeEmbeddedCheckoutSession';

function createCheckout() {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const session = createPrimeEmbeddedCheckoutSession(root);
  const form = document.createElement('form');
  const close = document.createElement('button');
  close.className = 'close-button';
  root.append(close, form);
  return { root, session, form, close };
}

afterEach(() => {
  document.body.innerHTML = '';
});

it('waits for a usable SDK close control and observes disabled changes', async () => {
  const { root, session, close } = createCheckout();
  const listener = jest.fn();
  session.subscribe(listener);
  expect(session.canSwitchToHosted()).toBe(false);
  await Promise.resolve();
  expect(session.canSwitchToHosted()).toBe(true);
  expect(listener).toHaveBeenCalledTimes(1);

  close.disabled = true;
  await Promise.resolve();
  expect(session.canSwitchToHosted()).toBe(false);
  close.disabled = false;
  await Promise.resolve();
  expect(session.canSwitchToHosted()).toBe(true);
  root.remove();
  expect(session.cancel('hostedCheckout')).toBe(false);
  session.finish();
});

it('uses only this checkout close control and records acknowledged cancellation', () => {
  const unrelated = document.createElement('button');
  unrelated.className = 'close-button';
  unrelated.onclick = jest.fn();
  document.body.appendChild(unrelated);
  const { root, session, close } = createCheckout();
  close.onclick = () => {
    root.innerHTML = '';
  };

  expect(session.cancel('hostedCheckout')).toBe(true);
  expect(session.getCancellation()).toBe('hostedCheckout');
  expect(session.canSwitchToHosted()).toBe(false);
  expect(unrelated.onclick).not.toHaveBeenCalled();
  expect(session.cancel('hostedCheckout')).toBe(false);
  session.finish();
});

it('keeps an ignored SDK cancellation retryable', () => {
  const { root, session, close } = createCheckout();
  expect(session.cancel('hostedCheckout')).toBe(false);
  expect(session.getCancellation()).toBeUndefined();
  expect(session.canSwitchToHosted()).toBe(true);
  close.onclick = () => {
    root.innerHTML = '';
  };
  expect(session.cancel('loadFailure')).toBe(true);
  expect(session.getCancellation()).toBe('loadFailure');
  session.finish();
});

it('blocks manual and automatic switching before the SDK handles form submission', () => {
  const { root, session, close, form } = createCheckout();
  close.onclick = jest.fn();
  const onSubmit = jest.fn(() => {
    expect(session.hasSubmitted()).toBe(true);
    expect(session.cancel('hostedCheckout')).toBe(false);
    expect(session.cancel('loadFailure')).toBe(false);
  });
  form.addEventListener('submit', onSubmit);
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(close.onclick).not.toHaveBeenCalled();
  expect(session.getCancellation()).toBeUndefined();
  expect(session.canSwitchToHosted()).toBe(false);
  root.appendChild(document.createElement('div'));
  expect(session.cancel('hostedCheckout')).toBe(false);
  session.finish();
});

it('disconnects its observers when the purchase finishes', async () => {
  const { session, close } = createCheckout();
  const listener = jest.fn();
  session.subscribe(listener);
  session.finish();
  close.disabled = true;
  await Promise.resolve();
  expect(session.canSwitchToHosted()).toBe(false);
  expect(listener).not.toHaveBeenCalled();
});
