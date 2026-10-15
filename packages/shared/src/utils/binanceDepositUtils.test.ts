import { EBinanceDepositSessionStatus } from '../../types/exchange';
import { BINANCE_DEPOSIT_TOKEN_REGEX } from '../consts/binanceDepositConsts';

import {
  findBinanceDepositAsset,
  generateBinanceDepositSessionKey,
  getBinanceDepositPhase,
  getBinanceDepositReturnDeadline,
  isAllowedBinanceDepositLink,
  isBinanceDepositAwaitingReturn,
  isBinanceDepositResumable,
  isSameBinanceDepositDestination,
  normalizeBinanceDepositTxHash,
  parseBinanceDepositReturnNonce,
} from './binanceDepositUtils';

import type {
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositLocalSession,
  IBinanceSupportedAssets,
} from '../../types/exchange';

const NONCE = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde';
const RETURN_URL = `onekey-wallet://binance-connect/deposit-return?rn=${NONCE}`;
const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

function buildSession(
  patch: Partial<IBinanceDepositLocalSession> = {},
): IBinanceDepositLocalSession {
  return {
    localId: 'local-1',
    sessionId: 'a'.repeat(64),
    networkId: 'evm--42161',
    cryptoCurrency: 'USDC',
    contractAddress: USDC_ARB,
    requiresAddressTag: false,
    status: EBinanceDepositSessionStatus.INIT,
    linkOpenedAt: 1000,
    createdAt: 1000,
    updatedAt: 1000,
    ...patch,
  };
}

const DESTINATION: IBinanceDepositAuthorizedDestination = {
  networkId: 'xrp--0',
  binanceNetwork: 'XRP',
  cryptoCurrency: 'XRP',
  address: 'rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh',
  addressTag: '123456',
  authorizedAt: 2000,
};

describe('generateBinanceDepositSessionKey', () => {
  it('returns a fresh 43-char base64url key each time', () => {
    const first = generateBinanceDepositSessionKey();
    const second = generateBinanceDepositSessionKey();
    expect(first).toMatch(BINANCE_DEPOSIT_TOKEN_REGEX);
    expect(second).toMatch(BINANCE_DEPOSIT_TOKEN_REGEX);
    expect(first).not.toBe(second);
  });
});

describe('parseBinanceDepositReturnNonce', () => {
  it('takes rn and ignores other parameters', () => {
    expect(parseBinanceDepositReturnNonce(RETURN_URL)).toBe(NONCE);
    expect(parseBinanceDepositReturnNonce(`${RETURN_URL}&foo=bar#x`)).toBe(
      NONCE,
    );
    expect(
      parseBinanceDepositReturnNonce(
        `ONEKEY-WALLET://Binance-Connect/deposit-return/?x=1&rn=${NONCE}`,
      ),
    ).toBe(NONCE);
  });

  it.each([
    ['other host', `onekey-wallet://other/deposit-return?rn=${NONCE}`],
    ['other path', `onekey-wallet://binance-connect/deposit?rn=${NONCE}`],
    ['other scheme', `https://binance-connect/deposit-return?rn=${NONCE}`],
    ['no rn', 'onekey-wallet://binance-connect/deposit-return?x=1'],
    ['two rn', `${RETURN_URL}&rn=${NONCE}`],
    ['short rn', `onekey-wallet://binance-connect/deposit-return?rn=abc`],
    [
      'encoded rn',
      `onekey-wallet://binance-connect/deposit-return?rn=${NONCE.slice(0, 40)}%2F1`,
    ],
  ])('rejects %s', (_name, url) => {
    expect(parseBinanceDepositReturnNonce(url)).toBeUndefined();
  });
});

describe('isAllowedBinanceDepositLink', () => {
  it('accepts https links on the allowlisted hosts', () => {
    expect(
      isAllowedBinanceDepositLink('https://app.binance.com/uni-qr/ocp?x=1'),
    ).toBe(true);
    expect(isAllowedBinanceDepositLink('https://www.binance.com/en')).toBe(
      true,
    );
  });

  it.each([
    'http://app.binance.com/uni-qr/ocp',
    'https://app.binance.com.evil.com/uni-qr/ocp',
    'https://evil.app.binance.com/uni-qr/ocp',
    'https://user@app.binance.com/uni-qr/ocp',
    'https://app.binance.com:8443/uni-qr/ocp',
    'https://app.binance.com\\@evil.com/',
    'onekey-wallet://binance-connect/deposit-return?rn=x',
    'not a url',
  ])('rejects %s', (link) => {
    expect(isAllowedBinanceDepositLink(link)).toBe(false);
  });
});

describe('findBinanceDepositAsset', () => {
  const assets: IBinanceSupportedAssets = {
    'evm--42161': {
      USDC: {
        withdrawEnable: true,
        depositEnable: true,
        binanceNetwork: 'ARBITRUM',
        contractAddress: USDC_ARB,
      },
      ETH: { withdrawEnable: true, depositEnable: true },
      USDT: {
        withdrawEnable: true,
        depositEnable: false,
        contractAddress: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
      },
    },
    'xrp--0': {
      XRP: {
        withdrawEnable: true,
        depositEnable: true,
        requiresAddressTag: true,
      },
    },
  };

  it('matches network, symbol and contract exactly', () => {
    expect(
      findBinanceDepositAsset({
        assets,
        networkId: 'evm--42161',
        symbol: 'usdc',
        contractAddress: USDC_ARB.toLowerCase(),
        isNative: false,
      }),
    ).toEqual({
      networkId: 'evm--42161',
      cryptoCurrency: 'USDC',
      contractAddress: USDC_ARB,
      requiresAddressTag: false,
    });
    expect(
      findBinanceDepositAsset({
        assets,
        networkId: 'xrp--0',
        symbol: 'XRP',
        contractAddress: '',
        isNative: true,
      })?.requiresAddressTag,
    ).toBe(true);
  });

  it.each([
    [
      'deposit disabled',
      'evm--42161',
      'USDT',
      '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
      false,
    ],
    [
      'other contract',
      'evm--42161',
      'USDC',
      '0x0000000000000000000000000000000000000001',
      false,
    ],
    ['native token vs listed contract', 'evm--42161', 'USDC', '', true],
    ['contract token vs native entry', 'evm--42161', 'ETH', USDC_ARB, false],
    ['unknown network', 'evm--1', 'USDC', USDC_ARB, false],
  ])('hides %s', (_name, networkId, symbol, contractAddress, isNative) => {
    expect(
      findBinanceDepositAsset({
        assets,
        networkId,
        symbol,
        contractAddress,
        isNative,
      }),
    ).toBeUndefined();
  });
});

describe('return acceptance', () => {
  it('waits only after the link was opened and before the deadline', () => {
    const session = buildSession();
    const deadline = getBinanceDepositReturnDeadline(session);
    expect(isBinanceDepositAwaitingReturn(session, deadline - 1)).toBe(true);
    expect(isBinanceDepositAwaitingReturn(session, deadline)).toBe(false);
    expect(
      isBinanceDepositAwaitingReturn(
        buildSession({ linkOpenedAt: undefined }),
        2000,
      ),
    ).toBe(false);
    expect(
      isBinanceDepositAwaitingReturn(
        buildSession({ sessionId: undefined }),
        2000,
      ),
    ).toBe(false);
    expect(
      isBinanceDepositAwaitingReturn(
        buildSession({ failReason: 'expired' }),
        2000,
      ),
    ).toBe(false);
    expect(
      isBinanceDepositAwaitingReturn(
        buildSession({ status: EBinanceDepositSessionStatus.AUTHORIZED }),
        2000,
      ),
    ).toBe(false);
  });

  it('uses the bind deadline once the server sent one', () => {
    const session = buildSession({
      status: EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND,
      bindDeadline: 5000,
    });
    expect(getBinanceDepositReturnDeadline(session)).toBe(5000);
    expect(isBinanceDepositAwaitingReturn(session, 4999)).toBe(true);
    expect(isBinanceDepositAwaitingReturn(session, 5000)).toBe(false);
  });

  it('caps the session deadline at the link expiry', () => {
    const early = getBinanceDepositReturnDeadline(
      buildSession({ linkExpireTime: 61_000 }),
    );
    const late = getBinanceDepositReturnDeadline(buildSession());
    expect(early).toBeLessThan(late);
  });
});

describe('isBinanceDepositResumable', () => {
  const asset = {
    networkId: 'evm--42161',
    cryptoCurrency: 'USDC',
    contractAddress: USDC_ARB,
    requiresAddressTag: false,
  };

  it('picks up an unfinished or released session of the same asset', () => {
    expect(isBinanceDepositResumable(buildSession(), asset, 2000)).toBe(true);
    expect(
      isBinanceDepositResumable(
        buildSession({
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          destination: DESTINATION,
        }),
        asset,
        Number.MAX_SAFE_INTEGER,
      ),
    ).toBe(true);
  });

  it('starts over for another asset, a failed or an expired session', () => {
    expect(
      isBinanceDepositResumable(
        buildSession(),
        { ...asset, cryptoCurrency: 'USDT' },
        2000,
      ),
    ).toBe(false);
    expect(
      isBinanceDepositResumable(
        buildSession({ failReason: 'expired' }),
        asset,
        2000,
      ),
    ).toBe(false);
    const session = buildSession();
    expect(
      isBinanceDepositResumable(
        session,
        asset,
        getBinanceDepositReturnDeadline(session),
      ),
    ).toBe(false);
  });
});

describe('getBinanceDepositPhase', () => {
  it.each([
    [buildSession({ status: 'LOCAL_PENDING_CREATE' }), false, 'creating'],
    [
      buildSession({ status: 'LOCAL_PENDING_CREATE', createFailed: true }),
      false,
      'create_failed',
    ],
    [buildSession(), false, 'awaiting'],
    [
      buildSession({ status: EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND }),
      false,
      'awaiting',
    ],
    [buildSession(), true, 'confirming'],
    [buildSession({ returnReceivedAt: 1500 }), false, 'confirming'],
    [
      buildSession({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        destination: DESTINATION,
      }),
      false,
      'authorized',
    ],
    [buildSession({ failReason: 'conflict' }), true, 'failed'],
  ] as const)('maps to %#', (session, isBinding, phase) => {
    expect(getBinanceDepositPhase(session, isBinding)).toBe(phase);
  });
});

describe('isSameBinanceDepositDestination', () => {
  it('compares every identity field, tag included', () => {
    expect(
      isSameBinanceDepositDestination(DESTINATION, {
        ...DESTINATION,
        authorizedAt: 9999,
      }),
    ).toBe(true);
    expect(
      isSameBinanceDepositDestination(DESTINATION, {
        ...DESTINATION,
        addressTag: '654321',
      }),
    ).toBe(false);
    expect(
      isSameBinanceDepositDestination(
        { ...DESTINATION, addressTag: undefined },
        { ...DESTINATION, addressTag: '' },
      ),
    ).toBe(true);
  });
});

describe('normalizeBinanceDepositTxHash', () => {
  const hex = 'ab'.repeat(32);
  it('prefixes EVM and strips TRON / XRP hashes', () => {
    expect(
      normalizeBinanceDepositTxHash({ networkId: 'evm--1', txid: hex }),
    ).toBe(`0x${hex}`);
    expect(
      normalizeBinanceDepositTxHash({
        networkId: 'tron--0x2b6653dc',
        txid: `0x${hex}`,
      }),
    ).toBe(hex);
    expect(
      normalizeBinanceDepositTxHash({ networkId: 'sol--101', txid: ' abc ' }),
    ).toBe('abc');
  });
});
