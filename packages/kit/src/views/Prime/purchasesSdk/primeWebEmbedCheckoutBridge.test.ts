/** @jest-environment jsdom */

import { PRIME_CHECKOUT_CANCEL_MESSAGE } from '@onekeyhq/shared/src/consts/webEmbedConsts';

import { createPrimeEmbeddedCheckoutSession } from './primeEmbeddedCheckoutSession';
import { createPrimeWebEmbedCheckoutBridge } from './primeWebEmbedCheckoutBridge';
import {
  PRIME_HOSTED_CHECKOUT_REQUESTED_MESSAGE,
  purchaseWithStripeLoadingGuard,
} from './purchaseWithStripeLoadingGuard';

jest.mock('./stripePaymentElementHealth', () => ({
  monitorStripePaymentElementLoading: () => () => undefined,
}));

const request = jest.fn(async (_params: unknown) => undefined);
const command = {
  type: PRIME_CHECKOUT_CANCEL_MESSAGE,
  checkoutId: 'modal',
  attemptId: 'attempt',
  requestId: 'request',
};
const send = (data: unknown = command) =>
  globalThis.dispatchEvent(
    new MessageEvent('message', { data, source: globalThis.window }),
  );

function setup() {
  const root = document.createElement('div');
  document.body.append(root);
  const session = createPrimeEmbeddedCheckoutSession(root);
  const form = document.createElement('form');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close-button';
  root.append(form, close);
  const bridge = createPrimeWebEmbedCheckoutBridge({
    session,
    checkoutId: 'modal',
    attemptId: 'attempt',
  });
  return { root, session, form, close, bridge };
}

beforeEach(() => {
  globalThis.addEventListener =
    EventTarget.prototype.addEventListener.bind(globalThis);
  request.mockClear();
  globalThis.$onekey = {
    $private: { request },
  } as unknown as typeof globalThis.$onekey;
});
afterEach(() => {
  document.body.replaceChildren();
});

it('waits for both cleared content and SDK cancellation, and ignores duplicate commands', async () => {
  const { root, session, close, bridge } = setup();
  const purchase = purchaseWithStripeLoadingGuard(
    () =>
      new Promise((_resolve, reject) => {
        close.onclick = jest.fn(() => {
          root.replaceChildren();
          reject(Object.assign(new Error('User cancelled'), { errorCode: 1 }));
        });
      }),
    session,
  ).catch((error: unknown) => error);
  send();
  send();
  expect(close.onclick).toHaveBeenCalledTimes(1);
  expect(bridge.getHostedRequestId()).toBe('request');
  expect(await purchase).toMatchObject({
    message: PRIME_HOSTED_CHECKOUT_REQUESTED_MESSAGE,
  });
  bridge.dispose();
});

it('retains the form if the SDK ignores cancellation and allows a later retry', () => {
  const { root, close, bridge } = setup();
  send();
  expect(root.childNodes.length).toBe(2);
  expect(bridge.getHostedRequestId()).toBeUndefined();
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      params: expect.objectContaining({
        requestId: 'request',
        cancelled: false,
        canSwitch: true,
      }),
    }),
  );
  close.onclick = () => root.replaceChildren();
  send({ ...command, requestId: 'retry' });
  expect(bridge.getHostedRequestId()).toBe('retry');
  bridge.dispose();
});

it.each([0, 2])(
  'does not convert an SDK error %s into hosted intent even if the content cleared',
  async (errorCode) => {
    const { root, session, close, bridge } = setup();
    const purchase = purchaseWithStripeLoadingGuard(
      () =>
        new Promise((_resolve, reject) => {
          close.onclick = () => {
            root.replaceChildren();
            reject(Object.assign(new Error('SDK failed'), { errorCode }));
          };
        }),
      session,
    ).catch((error: unknown) => error);
    send();
    expect(await purchase).toMatchObject({ errorCode });
    bridge.dispose();
  },
);

it('blocks a stale confirmation at submission time and stays locked after subsequent DOM changes', async () => {
  const { root, form, close, bridge } = setup();
  close.onclick = jest.fn();
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  send();
  close.disabled = false;
  root.append(document.createElement('span'));
  await Promise.resolve();
  send();
  expect(close.onclick).not.toHaveBeenCalled();
  expect(bridge.getHostedRequestId()).toBeUndefined();
  bridge.dispose();
});

it('ignores wrong instance/attempt, disabled close, and commands after page disposal', () => {
  const { close, bridge } = setup();
  close.onclick = jest.fn();
  send({ ...command, checkoutId: 'old-modal' });
  send({ ...command, attemptId: 'old-attempt' });
  close.disabled = true;
  send();
  close.disabled = false;
  bridge.dispose();
  send();
  expect(close.onclick).not.toHaveBeenCalled();
  expect(bridge.getHostedRequestId()).toBeUndefined();
});
