import {
  Address,
  Dictionary,
  beginCell,
  internal,
  loadStateInit,
  storeCommonMessageInfoRelaxed,
  storeStateInit,
} from '@ton/core';
import TonWeb from 'tonweb';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { decodePayload, encodeDecodedJetton } from './payload';
import {
  areTonSigningMessagesEquivalent,
  getTonHardwareSigningMessageCandidates,
  resolveTonHardwareSigningMessage,
} from './signingMessageValidation';

import type { IDecodedTonJetton } from './payload';
import type { Cell, CommonMessageInfoInternal, StateInit } from '@ton/core';

const RECIPIENT = `0:${'22'.repeat(32)}`;
const WALLET = `0:${'44'.repeat(32)}`;
const FROM = `0:${'11'.repeat(32)}`;

function jetton(overrides: Partial<IDecodedTonJetton> = {}): IDecodedTonJetton {
  return {
    queryId: '0',
    amount: '1500000',
    toAddress: RECIPIENT,
    responseAddress: FROM,
    forwardAmount: '1',
    forwardPayload: beginCell()
      .storeUint(0, 32)
      .storeStringTail('memo')
      .endCell(),
    ...overrides,
  };
}

function signingMessage({
  body = encodeDecodedJetton(jetton()),
  bodyRef = true,
  init,
  initCell,
  initRef = true,
  changes = {},
  mode = 3,
  seqno = 7,
  expiry = 2_000_000_000,
  walletId = 698_983_191,
  op = 0,
}: {
  body?: Cell;
  bodyRef?: boolean;
  init?: StateInit;
  initCell?: Cell;
  initRef?: boolean;
  changes?: Partial<CommonMessageInfoInternal>;
  mode?: number;
  seqno?: number;
  expiry?: number;
  walletId?: number;
  op?: number;
} = {}) {
  const message = internal({
    to: WALLET,
    value: 50_000_000n,
    bounce: true,
    body,
    init,
  });
  if (message.info.type !== 'internal') {
    throw new OneKeyLocalError('Expected an internal message');
  }
  const builder = beginCell()
    .store(storeCommonMessageInfoRelaxed({ ...message.info, ...changes }))
    .storeBit(!!init || !!initCell);
  if (init || initCell) {
    builder.storeBit(initRef);
    const encodedInit =
      initCell ??
      beginCell()
        .store(storeStateInit(init ?? {}))
        .endCell();
    if (initRef) {
      builder.storeRef(encodedInit);
    } else {
      builder.storeSlice(encodedInit.beginParse());
    }
  }
  builder.storeBit(bodyRef);
  if (bodyRef) {
    builder.storeRef(body);
  } else {
    builder.storeSlice(body.beginParse());
  }
  return beginCell()
    .storeUint(walletId, 32)
    .storeUint(expiry, 32)
    .storeUint(seqno, 32)
    .storeUint(op, 8)
    .storeUint(mode, 8)
    .storeRef(builder.endCell())
    .endCell();
}

beforeEach(() => {
  jest
    .spyOn(appLocale.intl, 'formatMessage')
    .mockReturnValue('Failed to sign transaction');
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('TON signing message semantic validation', () => {
  it('allows inline/reference message bodies and preserves the returned device layout', () => {
    const body = beginCell().storeUint(0, 32).storeStringTail('memo').endCell();
    const expected = signingMessage({ body });
    const actual = signingMessage({ body, bodyRef: false });
    expect(actual.hash()).not.toEqual(expected.hash());
    expect(areTonSigningMessagesEquivalent(expected, actual)).toBe(true);
    const returnedMessage = actual
      .toBoc({ idx: true, crc32: false })
      .toString('hex');
    const resolved = resolveTonHardwareSigningMessage({
      expected,
      candidates: [expected],
      returnedMessage,
      signature: new Uint8Array(64),
      publicKey: new Uint8Array(32),
    });
    expect(resolved.hash()).toEqual(actual.hash());
  });

  it('accepts either precomputed signing path without accepting changed transfer content', () => {
    const app = signingMessage({ expiry: 2_000_000_000 });
    const sdk = signingMessage({ expiry: 2_000_000_100 });
    const options = {
      expected: app,
      alternateExpected: sdk,
      candidates: [app, sdk],
      signature: new Uint8Array(64),
      publicKey: new Uint8Array(32),
    };
    expect(
      resolveTonHardwareSigningMessage({
        ...options,
        returnedMessage: sdk.toBoc().toString('hex'),
      }).hash(),
    ).toEqual(sdk.hash());
    expect(
      resolveTonHardwareSigningMessage({
        ...options,
        returnedMessage: app.hash().toString('hex'),
      }).hash(),
    ).toEqual(app.hash());
    const tampered = signingMessage({
      expiry: 2_000_000_100,
      body: encodeDecodedJetton(jetton({ toAddress: FROM })),
    });
    expect(() =>
      resolveTonHardwareSigningMessage({
        ...options,
        returnedMessage: tampered.toBoc().toString('hex'),
      }),
    ).toThrow();
    expect(() =>
      resolveTonHardwareSigningMessage({
        ...options,
        returnedMessage: signingMessage({ expiry: 2_000_000_200 })
          .toBoc()
          .toString('hex'),
      }),
    ).toThrow();
  });

  it('allows StateInit inline/reference layouts while checking all its fields', () => {
    const body = beginCell().endCell();
    const init: StateInit = {
      code: beginCell().storeUint(1, 8).endCell(),
      data: beginCell().storeUint(2, 8).endCell(),
      // oxlint-disable-next-line @cspell/spellchecker
      special: { tick: true, tock: false },
    };
    const expected = signingMessage({ body, init });
    expect(
      areTonSigningMessagesEquivalent(
        expected,
        signingMessage({ body, init, initRef: false }),
      ),
    ).toBe(true);
    expect(
      areTonSigningMessagesEquivalent(
        expected,
        signingMessage({
          body,
          // oxlint-disable-next-line @cspell/spellchecker
          init: { ...init, special: { tick: false, tock: false } },
        }),
      ),
    ).toBe(false);
  });

  it('allows Jetton forward payload inline/reference layouts', () => {
    const expected = signingMessage({
      body: encodeDecodedJetton(jetton(), false),
    });
    const actual = signingMessage({
      body: encodeDecodedJetton(jetton(), true),
    });
    expect(expected.hash()).not.toEqual(actual.hash());
    expect(areTonSigningMessagesEquivalent(expected, actual)).toBe(true);
  });

  it('rejects different inner StateInit hashes even when parsed libraries are equal', () => {
    const library = beginCell().storeUint(7, 8).endCell();
    const dictionary = beginCell()
      .storeBit(false)
      .storeUint((1n << 256n) - 1n, 256)
      .storeBit(false)
      .storeUint(0, 256)
      .storeBit(true)
      .storeRef(library)
      .endCell();
    const originalInit = beginCell()
      .storeBit(false)
      .storeBit(false)
      .storeMaybeRef(null)
      .storeMaybeRef(null)
      .storeMaybeRef(dictionary)
      .endCell();
    const canonicalInit = beginCell()
      .store(storeStateInit(loadStateInit(originalInit.beginParse())))
      .endCell();
    expect(originalInit.hash()).not.toEqual(canonicalInit.hash());
    const body = beginCell().endCell();
    expect(
      areTonSigningMessagesEquivalent(
        signingMessage({ body, initCell: originalInit }),
        signingMessage({ body, initCell: canonicalInit }),
      ),
    ).toBe(false);
  });

  it('correctly consumes custom and forward references without losing nested payloads', () => {
    const customPayload = beginCell().storeUint(3, 8).endCell();
    const forwardPayload = beginCell()
      .storeUint(9, 32)
      .storeRef(beginCell().storeUint(5, 8).endCell())
      .endCell();
    const decoded = decodePayload(
      encodeDecodedJetton(jetton({ customPayload, forwardPayload })).toBoc(),
    ).jetton;
    expect(decoded?.customPayload?.hash()).toEqual(customPayload.hash());
    expect(decoded?.forwardPayload.hash()).toEqual(forwardPayload.hash());
  });

  it.each([
    { toAddress: `0:${'33'.repeat(32)}` },
    { amount: '1500001' },
    { queryId: '1' },
    { responseAddress: RECIPIENT },
    { forwardAmount: '2' },
    { customPayload: beginCell().storeUint(7, 8).endCell() },
    {
      forwardPayload: beginCell()
        .storeUint(0, 32)
        .storeStringTail('changed')
        .endCell(),
    },
    {
      forwardPayload: beginCell()
        .storeUint(9, 32)
        .storeRef(beginCell().storeUint(6, 8).endCell())
        .endCell(),
    },
  ])('rejects a change to Jetton transaction content, case %#', (change) => {
    expect(
      areTonSigningMessagesEquivalent(
        signingMessage(),
        signingMessage({ body: encodeDecodedJetton(jetton(change)) }),
      ),
    ).toBe(false);
  });

  it.each([
    { mode: 128 },
    { seqno: 8 },
    { expiry: 2_000_000_001 },
    { walletId: 1 },
    { op: 1 },
  ])('rejects a change to the wallet header or mode, case %#', (change) => {
    expect(
      areTonSigningMessagesEquivalent(signingMessage(), signingMessage(change)),
    ).toBe(false);
  });

  it.each([
    { dest: Address.parse(RECIPIENT) },
    { bounce: false },
    { bounced: true },
    { ihrDisabled: false },
    { src: Address.parse(FROM) },
    { ihrFee: 1n },
    { forwardFee: 1n },
    { createdLt: 1n },
    { createdAt: 1 },
    { value: { coins: 50_000_001n } },
    {
      value: {
        coins: 50_000_000n,
        other: Dictionary.empty(
          Dictionary.Keys.Uint(32),
          Dictionary.Values.BigVarUint(5),
        ).set(1, 1n),
      },
    },
  ])('rejects changes to internal message fields, case %#', (changes) => {
    expect(
      areTonSigningMessagesEquivalent(
        signingMessage(),
        signingMessage({ changes }),
      ),
    ).toBe(false);
  });

  it('requires a Classic hash to match a semantically equivalent candidate', () => {
    const expected = signingMessage({
      body: encodeDecodedJetton(jetton(), false),
    });
    const classic = signingMessage();
    const options = {
      expected,
      candidates: [expected, classic],
      signature: new Uint8Array(64),
      publicKey: new Uint8Array(32),
    };
    expect(
      resolveTonHardwareSigningMessage({
        ...options,
        returnedMessage: classic.hash().toString('hex'),
      }),
    ).toBe(classic);
    expect(() =>
      resolveTonHardwareSigningMessage({
        ...options,
        returnedMessage: 'ff'.repeat(32),
      }),
    ).toThrow();
    const tampered = signingMessage({ seqno: 8 });
    expect(() =>
      resolveTonHardwareSigningMessage({
        ...options,
        candidates: [tampered],
        returnedMessage: tampered.hash().toString('hex'),
      }),
    ).toThrow();
  });

  it('reconstructs a reference-body layout for Classic hash and signature-only responses', () => {
    const body = beginCell().storeUint(0, 32).storeStringTail('memo').endCell();
    const expected = signingMessage({ body, bodyRef: false });
    const actual = signingMessage({ body, bodyRef: true });
    const candidates = getTonHardwareSigningMessageCandidates(expected, [
      false,
    ]);
    expect(
      candidates.some((candidate) => candidate.hash().equals(actual.hash())),
    ).toBe(true);
    const pair = TonWeb.utils.nacl.sign.keyPair.fromSeed(
      new Uint8Array(32).fill(9),
    );
    const signature = TonWeb.utils.nacl.sign.detached(
      actual.hash(),
      pair.secretKey,
    );
    const options = {
      expected,
      candidates,
      signature,
      publicKey: pair.publicKey,
    };
    expect(
      resolveTonHardwareSigningMessage({
        ...options,
        returnedMessage: actual.hash().toString('hex'),
      }).hash(),
    ).toEqual(actual.hash());
    expect(resolveTonHardwareSigningMessage(options).hash()).toEqual(
      actual.hash(),
    );
  });

  it('verifies the signature when a blind response omits the signing message', () => {
    const expected = signingMessage();
    const pair = TonWeb.utils.nacl.sign.keyPair.fromSeed(
      new Uint8Array(32).fill(7),
    );
    const signature = TonWeb.utils.nacl.sign.detached(
      expected.hash(),
      pair.secretKey,
    );
    const options = {
      expected,
      candidates: [expected],
      signature,
      publicKey: pair.publicKey,
    };
    expect(resolveTonHardwareSigningMessage(options)).toBe(expected);
    expect(() =>
      resolveTonHardwareSigningMessage({
        ...options,
        signature: new Uint8Array(64),
      }),
    ).toThrow();
  });

  it('rejects unparsed wallet trailing bits', () => {
    const expected = signingMessage();
    const actual = beginCell()
      .storeSlice(expected.beginParse())
      .storeBit(true)
      .endCell();
    expect(areTonSigningMessagesEquivalent(expected, actual)).toBe(false);
  });
});
