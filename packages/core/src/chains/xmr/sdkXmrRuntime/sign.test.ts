import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { setXmrRuntimeLoader } from './address';
import { signXmrTransaction } from './sign';

import type { IXmrPureRuntimeApi } from './address';

const review = {
  network: 'mainnet' as const,
  fromAddress: 'sender',
  toAddress: 'recipient',
  amountAtomic: '9007199254740993',
  feeAtomic: '100',
  changeAtomic: '0',
  isMaxSend: true,
};

function runtime() {
  const api: IXmrPureRuntimeApi = {
    deriveAccount: async () => '',
    deriveSubaddress: async () => '',
    validateAddress: async () => true,
    verifyTransaction: jest.fn(async () => undefined),
    signTransactionWithBip32Key: jest.fn(async () =>
      JSON.stringify({ txid: '11'.repeat(32), rawHex: 'aabb', sizeBytes: 2 }),
    ),
  };
  setXmrRuntimeLoader(async () => api);
  return api;
}
const sign = () =>
  signXmrTransaction({
    signableHex: 'aabb',
    bip32PrivateKeyHex: 'synthetic-test-key',
    review,
  });

describe('Monero signing capability and review boundary', () => {
  it('requires the verifier even when an old signer would ignore extra arguments', async () => {
    const api = runtime();
    Reflect.deleteProperty(api, 'verifyTransaction');
    await expect(sign()).rejects.toThrow();
    expect(api.signTransactionWithBip32Key).not.toHaveBeenCalled();
  });
  it('sends no key when the transaction differs from the review', async () => {
    const api = runtime();
    jest
      .spyOn(api, 'verifyTransaction')
      .mockRejectedValue(new Error('review mismatch'));
    await expect(sign()).rejects.toThrow('review mismatch');
    expect(api.signTransactionWithBip32Key).not.toHaveBeenCalled();
  });
  it('forwards the same canonical approval to verification and signing', async () => {
    const api = runtime();
    await expect(sign()).resolves.toMatchObject({
      txid: '11'.repeat(32),
      sizeBytes: 2,
    });
    const json = stringUtils.stableStringify(review);
    expect(api.verifyTransaction).toHaveBeenCalledWith('aabb', json);
    // The BIP-32 key crosses once and the runtime reduces it; no spend key
    // round trip.
    expect(api.signTransactionWithBip32Key).toHaveBeenCalledTimes(1);
    expect(api.signTransactionWithBip32Key).toHaveBeenCalledWith(
      'aabb',
      'synthetic-test-key',
      json,
    );
  });
  it('rejects an inconsistent signed response', async () => {
    const api = runtime();
    jest
      .spyOn(api, 'signTransactionWithBip32Key')
      .mockResolvedValue(
        JSON.stringify({ txid: '11'.repeat(32), rawHex: 'aabb', sizeBytes: 3 }),
      );
    await expect(sign()).rejects.toThrow('invalid signed transaction response');
  });
});
