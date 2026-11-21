import {
  InvalidLightningPaymentRequest,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';

import LightningVault from './Vault';

// BOLT 11 mainnet and testnet example invoices.
const INVOICE =
  'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql';

const TESTNET_INVOICE =
  'lntb20m1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygshp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqfpp3x9et2e20v6pu37c5d9vax37wxq72un989qrsgqdj545axuxtnfemtpwkc45hx9d2ft7x04mt8q7y6t0k2dge9e7h8kpy9p34ytyslj3yu569aalz2xdk8xkd7ltxqld94u8h2esmsmacgpghe9k8';

function vaultDecodingWith(decode: jest.Mock, isTestnet = false) {
  return Object.assign(Object.create(LightningVault.prototype), {
    decodedInvoice: decode,
    getNetwork: async () => ({ isTestnet }),
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

  it.each([
    ['a mainnet invoice', INVOICE, false],
    ['a testnet invoice', TESTNET_INVOICE, true],
  ])(
    'validates %s only on its own Lightning network',
    async (_label, invoice, isTestnet) => {
      const input = `LIGHTNING:${invoice.toUpperCase()}`;
      const decode = jest.fn(async () => ({}));
      await expect(
        vaultDecodingWith(decode, isTestnet).validateAddress(input),
      ).resolves.toMatchObject({ isValid: true, normalizedAddress: invoice });
      await expect(
        vaultDecodingWith(decode, !isTestnet).validateAddress(input),
      ).rejects.toBeInstanceOf(InvalidLightningPaymentRequest);
      expect(decode).toHaveBeenCalledTimes(1);
    },
  );

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

  it.each([
    'lightning:lnurlp://example.com/pay\nThanks',
    'Pay:\nlnurlp://merchant.example/checkout?order=12\n34',
    '请支付：lnurlp://merchant.example/checkout?order=12 \r\n34',
  ])(
    'rejects an ambiguous multiline LNURL without sending it to the invoice decoder',
    async (text) => {
      const decode = jest.fn();
      const vault = vaultDecodingWith(decode);
      await expect(vault.validateAddress(text)).resolves.toMatchObject({
        isValid: false,
      });
      expect(decode).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['Pay here: (lnurlp://example.com/pay).', 'lnurlp://example.com/pay'],
    ['(lnurlp://example.com/pay)\nThanks', 'lnurlp://example.com/pay'],
    ['lnurlp://example.com/pay\n\nThanks', 'lnurlp://example.com/pay'],
    [
      'Pay here: lnurlp://example.com/pay?note=thanks!',
      'lnurlp://example.com/pay?note=thanks!',
    ],
  ])(
    'preserves the LNURL recipient from pasted payment text: %s',
    async (input, address) => {
      const decode = jest.fn(async () => ({}));
      const vault = vaultDecodingWith(decode);
      const validation = {
        isValid: true,
        normalizedAddress: address,
        displayAddress: address,
      };
      await expect(vault.validateAddress(input)).resolves.toEqual(validation);
      await expect(vault.validateAddress(address)).resolves.toEqual(validation);
      expect(decode).not.toHaveBeenCalled();
    },
  );
});
