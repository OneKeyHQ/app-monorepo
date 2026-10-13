import { isBinanceConnectDeepLink } from '../binanceConnectDeepLink';

// The check is imported statically by the generic deep link entry of every
// platform, so it has to stay a leaf: constants only. Each module below is
// something the return handler needs and the check must not bring along;
// requiring any of them while this suite loads the check fails the suite.
jest.mock('../binanceDepositReturn', () => {
  throw new TypeError('binanceDepositReturn was loaded by the URL check');
});
jest.mock('@onekeyhq/shared/src/utils/binanceDepositUtils', () => {
  throw new TypeError('binanceDepositUtils was loaded by the URL check');
});
jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  throw new TypeError('the logger was loaded by the URL check');
});
jest.mock('../../../../background/instance/backgroundApiProxy', () => {
  throw new TypeError('backgroundApiProxy was loaded by the URL check');
});
jest.mock('expo-linking', () => {
  throw new TypeError('expo-linking was loaded by the URL check');
});
jest.mock('@noble/hashes/sha256', () => {
  throw new TypeError('@noble/hashes was loaded by the URL check');
});

const nonce = `000001${'aB3-_'.repeat(8)}`.slice(0, 43);

describe('isBinanceConnectDeepLink', () => {
  it.each([
    `onekey-wallet://binance-connect/deposit-return?rn=${nonce}`,
    `onekey-wallet://binance-connect/deposit-return/?rn=${nonce}`,
    `ONEKEY-WALLET://Binance-Connect/deposit-return?rn=${nonce}`,
    `onekey-wallet://binance-connect/deposit-return?rn=${nonce}#fragment`,
    // Not a well-formed return, but still addressed to the reserved host.
    'onekey-wallet://binance-connect',
    'onekey-wallet://binance-connect/',
    `onekey-wallet://binance-connect?rn=${nonce}`,
    `onekey-wallet://binance-connect#rn=${nonce}`,
    `onekey-wallet://binance-connect/Deposit-Return?rn=${nonce}`,
    `onekey-wallet://binance-connect//deposit-return?rn=${nonce}`,
    `onekey-wallet://binance-connect/deposit-return/extra?rn=${nonce}`,
    `onekey-wallet:binance-connect/deposit-return?rn=${nonce}`,
    `onekey-wallet:///binance-connect/deposit-return?rn=${nonce}`,
  ])('claims %s', (url) => {
    expect(isBinanceConnectDeepLink(url)).toBe(true);
  });

  it.each([
    undefined,
    null,
    '',
    'onekey-wallet://',
    'onekey-wallet://wc?uri=wc%3Aabc',
    'onekey-wallet://prime_subscription',
    `onekey-wallet://binance-connect-other/deposit-return?rn=${nonce}`,
    `onekey-wallet://other/binance-connect/deposit-return?rn=${nonce}`,
    `onekey-wallet://webview?url=binance-connect/deposit-return&rn=${nonce}`,
    `https://binance-connect/deposit-return?rn=${nonce}`,
    `wc://binance-connect/deposit-return?rn=${nonce}`,
    `not-onekey-wallet://binance-connect/deposit-return?rn=${nonce}`,
  ])('leaves %s to the generic pipeline', (url) => {
    expect(isBinanceConnectDeepLink(url)).toBe(false);
  });

  it('never prints the url it is asked about', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (method) => jest.spyOn(console, method).mockImplementation(() => {}),
    );
    try {
      isBinanceConnectDeepLink(
        `onekey-wallet://binance-connect/deposit-return?rn=${nonce}`,
      );
      isBinanceConnectDeepLink(`onekey-wallet://wc?uri=${nonce}`);
      spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });
});
