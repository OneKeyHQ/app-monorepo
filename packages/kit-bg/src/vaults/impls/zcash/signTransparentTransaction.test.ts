import { zcashTransparentScriptForAddress } from '@onekeyhq/core/src/chains/zcash/sdkZcash';
import type { IZcashTransparentTxRequest } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';

import { signTransparentTransaction } from './signTransparentTransaction';

import type { IEncodedTxZcash } from './types';

const originalIntl = appLocale.intl;
beforeAll(async () => {
  appLocale.setLocale('en-US', await loadLocaleMessages('en-US'));
});
afterAll(() => {
  appLocale.setLocale(originalIntl.locale, originalIntl.messages);
});

const outpoints = [
  { txid: 'public-tx-a', vout: 0 },
  { txid: 'public-tx-b', vout: 1 },
];
// Real encodings: the check decodes them to output scripts.
const RECIPIENT = 't1Hsc1LR8yKnbbe3twRp88p6vFfC5t7DLbs';
const CHANGE = 't1VpYecBW4UudbGcy4ufh61eWxQCoFaUrPs';
const request = {
  selectedOutpoints: outpoints,
  targetHeight: 100,
  expiryHeight: 120,
  recipients: [{ address: RECIPIENT, amountZat: '50000' }],
  sendMax: false,
  change: { address: CHANGE, derivationPath: "m/44'/133'/0'/1/0" },
} as IZcashTransparentTxRequest;
const recipientScript = zcashTransparentScriptForAddress(RECIPIENT) ?? '';
const changeScript = zcashTransparentScriptForAddress(CHANGE) ?? '';
const reviewedOutputs = [
  { valueZat: '50000', scriptPubKey: recipientScript },
  { valueZat: '40000', scriptPubKey: changeScript },
];
const encodedTx = {
  fee: '10000',
  zcashTransparentPlan: { ownerId: 'owner' },
} as IEncodedTxZcash;
const result = {
  txid: 'signed-public-tx',
  rawTx: 'synthetic-transaction',
  feeZat: '10000',
  expiryHeight: 120,
  spentOutpoints: outpoints,
};
function setup() {
  const journal = {
    reserveTransparentOutpoints: jest.fn().mockResolvedValue(undefined),
    saveTransparentPendingTx: jest.fn().mockResolvedValue(undefined),
    releaseTransparentReservation: jest.fn().mockResolvedValue(undefined),
  };
  return {
    journal,
    sign: jest.fn().mockResolvedValue(result),
    parseOutputs: jest.fn().mockResolvedValue(reviewedOutputs),
  };
}

it('retains reservations for signed transactions until broadcast resolution', async () => {
  const { journal, sign, parseOutputs } = setup();
  const signed = await signTransparentTransaction({
    journal,
    sign,
    parseOutputs,
    accountId: 'account',
    encodedTx,
    request,
  });
  expect(signed.txid).toBe(result.txid);
  expect(journal.saveTransparentPendingTx).toHaveBeenCalledWith(
    expect.objectContaining({
      requireLiveReservation: true,
      tx: expect.objectContaining({
        broadcastAuthorized: false,
        broadcastState: 'unknown',
      }),
    }),
  );
  expect(journal.releaseTransparentReservation).not.toHaveBeenCalled();
});

it.each([
  { feeZat: '1' },
  { expiryHeight: 121 },
  { spentOutpoints: [outpoints[0], outpoints[0]] },
  { spentOutpoints: [outpoints[0]] },
])('rejects a result differing from review: %j', async (change) => {
  const { journal, sign, parseOutputs } = setup();
  sign.mockResolvedValue({ ...result, ...change });
  await expect(
    signTransparentTransaction({
      journal,
      sign,
      parseOutputs,
      accountId: 'account',
      encodedTx,
      request,
    }),
  ).rejects.toThrow('did not match');
  expect(journal.saveTransparentPendingTx).not.toHaveBeenCalled();
  expect(journal.releaseTransparentReservation).toHaveBeenCalledWith({
    accountId: 'account',
    ownerId: 'owner',
  });
});

it.each(['sign', 'save'] as const)(
  'releases the reservation when %s fails',
  async (stage) => {
    const { journal, sign, parseOutputs } = setup();
    (stage === 'sign'
      ? sign
      : journal.saveTransparentPendingTx
    ).mockRejectedValue(new Error('failure'));
    await expect(
      signTransparentTransaction({
        journal,
        sign,
        parseOutputs,
        accountId: 'account',
        encodedTx,
        request,
      }),
    ).rejects.toThrow('failure');
    expect(journal.releaseTransparentReservation).toHaveBeenCalledTimes(1);
  },
);

// The runtime's message is the bare code; the user sees the wording.
it('reports a runtime failure in user wording', async () => {
  const { journal, sign, parseOutputs } = setup();
  sign.mockRejectedValue(
    Object.assign(new Error('INSUFFICIENT_FUNDS'), {
      code: 'INSUFFICIENT_FUNDS',
      params: {},
    }),
  );
  await expect(
    signTransparentTransaction({
      journal,
      sign,
      parseOutputs,
      accountId: 'account',
      encodedTx,
      request,
    }),
  ).rejects.toMatchObject({
    message: 'Insufficient ZEC balance',
    key: ETranslations.send_error_insufficient_balance,
    info: { token: 'ZEC' },
    code: 'INSUFFICIENT_FUNDS',
  });
});

it('does not release another owner when reservation acquisition fails', async () => {
  const { journal, sign, parseOutputs } = setup();
  journal.reserveTransparentOutpoints.mockRejectedValue(new Error('reserved'));
  await expect(
    signTransparentTransaction({
      journal,
      sign,
      parseOutputs,
      accountId: 'account',
      encodedTx,
      request,
    }),
  ).rejects.toThrow('reserved');
  expect(sign).not.toHaveBeenCalled();
  expect(journal.releaseTransparentReservation).not.toHaveBeenCalled();
});

// Fee, expiry and inputs echo the request; only the outputs show a signer
// that paid someone else.
it.each([
  [
    'a swapped recipient',
    [
      { valueZat: '50000', scriptPubKey: changeScript },
      { valueZat: '40000', scriptPubKey: changeScript },
    ],
  ],
  [
    'a changed amount',
    [
      { valueZat: '50001', scriptPubKey: recipientScript },
      { valueZat: '39999', scriptPubKey: changeScript },
    ],
  ],
  [
    'an extra output',
    [
      ...reviewedOutputs,
      { valueZat: '1', scriptPubKey: `76a914${'11'.repeat(20)}88ac` },
    ],
  ],
])('rejects a signed transaction with %s', async (_label, outputs) => {
  const { journal, sign, parseOutputs } = setup();
  parseOutputs.mockResolvedValue(outputs);
  await expect(
    signTransparentTransaction({
      journal,
      sign,
      parseOutputs,
      accountId: 'account',
      encodedTx,
      request,
    }),
  ).rejects.toThrow('did not match');
});
