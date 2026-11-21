import {
  InvalidLightningPaymentRequest,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';

import LightningVault from './Vault';

// The first BOLT 11 example invoice.
const INVOICE =
  'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql';

function vaultDecodingWith(decode: jest.Mock) {
  return Object.assign(Object.create(LightningVault.prototype), {
    decodedInvoice: decode,
  }) as LightningVault;
}

describe('LightningVault.validateAddress', () => {
  it.each([
    ['a bare invoice', INVOICE],
    ['lightning:<invoice>', `lightning:${INVOICE}`],
    ['an upper case QR code', `lightning:${INVOICE}`.toUpperCase()],
  ])('validates %s as the bare invoice', async (_label, input) => {
    const decode = jest.fn(async () => ({}));
    await expect(
      vaultDecodingWith(decode).validateAddress(input),
    ).resolves.toEqual({
      isValid: true,
      normalizedAddress: INVOICE,
      displayAddress: INVOICE,
    });
    expect(decode).toHaveBeenCalledWith(INVOICE);
  });

  it.each(['satoshi@example.com', 'lnurlalice@example.com'])(
    'preserves the complete lightning address %s behind the scheme',
    async (address) => {
      const decode = jest.fn();
      await expect(
        vaultDecodingWith(decode).validateAddress(`lightning:${address}`),
      ).resolves.toMatchObject({
        isValid: true,
        normalizedAddress: address,
      });
      expect(decode).not.toHaveBeenCalled();
    },
  );

  it('still rejects what the decoder rejects', async () => {
    const decode = jest.fn(async () => {
      throw new OneKeyLocalError('not an invoice');
    });
    await expect(
      vaultDecodingWith(decode).validateAddress('lightning:hello'),
    ).rejects.toBeInstanceOf(InvalidLightningPaymentRequest);
    expect(decode).toHaveBeenCalledWith('hello');
  });

  it('preserves the LNURL URI for the second recipient validation', async () => {
    const decode = jest.fn(async () => ({}));
    const vault = vaultDecodingWith(decode);
    const address = 'lnurlp://example.com/pay';
    const first = await vault.validateAddress(`lightning:${address}`);
    expect(first.displayAddress).toBe(address);
    await expect(vault.validateAddress(first.displayAddress)).resolves.toEqual(
      first,
    );
    expect(decode).not.toHaveBeenCalled();
  });

  it('extracts a valid LNURL from pasted payment text before validation', async () => {
    const decode = jest.fn(async () => ({}));
    const vault = vaultDecodingWith(decode);
    const address = 'lnurlp://example.com/pay';
    await expect(
      vault.validateAddress(`Pay here: ${address}`),
    ).resolves.toEqual({
      isValid: true,
      normalizedAddress: address,
      displayAddress: address,
    });
    expect(decode).not.toHaveBeenCalled();
  });
});
