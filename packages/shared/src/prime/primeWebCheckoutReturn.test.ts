import { isPrimeWebCheckoutReturnFromCheckoutTab } from './primeWebCheckoutReturn';

/*
yarn test packages/shared/src/prime/primeWebCheckoutReturn.test.ts
*/

const extension = {
  initiatorKind: 'tab' as const,
  initiatorTabId: 1,
  checkoutTabId: 2,
  browserSessionId: 'session-1',
};
const sender = {
  tabId: 2,
  frameId: 0,
  url: 'https://app.onekey.so/prime/purchase-complete?app_user_id=user-1',
};

describe('isPrimeWebCheckoutReturnFromCheckoutTab', () => {
  it('accepts the top frame of the checkout tab on the return route', () => {
    expect(
      isPrimeWebCheckoutReturnFromCheckoutTab({
        extension,
        browserSessionId: 'session-1',
        sender,
      }),
    ).toBe(true);
    expect(
      isPrimeWebCheckoutReturnFromCheckoutTab({
        extension,
        browserSessionId: 'session-1',
        sender: {
          ...sender,
          url: 'https://app.onekeytest.com/prime/purchase-complete/',
        },
      }),
    ).toBe(true);
  });

  it.each([
    ['another tab', { sender: { ...sender, tabId: 3 } }],
    ['a sub frame', { sender: { ...sender, frameId: 4 } }],
    [
      'another route',
      { sender: { ...sender, url: 'https://app.onekey.so/market' } },
    ],
    ['an unknown sender', { sender: undefined }],
    ['another browser session', { browserSessionId: 'session-2' }],
    ['no browser session', { browserSessionId: undefined }],
    [
      'no recorded tab',
      { extension: { ...extension, checkoutTabId: undefined } },
    ],
    ['no extension context', { extension: undefined }],
  ])('rejects %s', (_label, overrides) => {
    expect(
      isPrimeWebCheckoutReturnFromCheckoutTab({
        extension,
        browserSessionId: 'session-1',
        sender,
        ...overrides,
      }),
    ).toBe(false);
  });
});
