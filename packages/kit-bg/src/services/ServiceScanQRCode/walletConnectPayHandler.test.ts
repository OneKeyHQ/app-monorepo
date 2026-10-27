import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import { parseQRCode as parse } from './utils/parseQRCode';

// yarn jest packages/kit-bg/src/services/ServiceScanQRCode/walletConnectPayHandler.test.ts
describe('walletConnectPay QR handler', () => {
  it('parses a pay.walletconnect.com path-form link', async () => {
    expect(await parse('https://pay.walletconnect.com/pay_123')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.WALLET_CONNECT_PAY,
        data: { paymentLink: 'https://pay.walletconnect.com/pay_123' },
      }),
    );
  });

  it('parses a pay.walletconnect.com pid-query link', async () => {
    expect(await parse('https://pay.walletconnect.com/?pid=pay_123')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.WALLET_CONNECT_PAY,
      }),
    );
  });

  it('parses a subdomain of pay.walletconnect.com', async () => {
    expect(
      await parse('https://checkout.pay.walletconnect.com/pay_abc'),
    ).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.WALLET_CONNECT_PAY,
      }),
    );
  });

  it('parses a wc: URI carrying a pay param as payment, not pairing', async () => {
    expect(await parse('wc:abc@2?pay=eyJ0IjoxfQ')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.WALLET_CONNECT_PAY,
      }),
    );
  });

  it('still parses a plain wc: pairing URI as WALLET_CONNECT', async () => {
    const pairingUri =
      // oxlint-disable-next-line @cspell/spellchecker
      'wc:6b18a69c27df54b4c228e0ff60218ba460a4994aa5775963f6f0ee354b629afe@2?relay-protocol=irn&symKey=99f6e5fa2bda94c704be8d7adbc2643b861ef49dbe09e0af26d3713e219b4355';
    expect(await parse(pairingUri)).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.WALLET_CONNECT,
      }),
    );
  });

  it('rejects a look-alike host that merely starts with pay.walletconnect.com', async () => {
    const result = await parse(
      'https://pay.walletconnect.com.evil.com/pay_123',
    );
    expect(result.type).not.toEqual(EQRCodeHandlerType.WALLET_CONNECT_PAY);
  });

  it('rejects an untrusted host carrying a pid query', async () => {
    const result = await parse('https://evil.com/?pid=pay_123');
    expect(result.type).not.toEqual(EQRCodeHandlerType.WALLET_CONNECT_PAY);
  });

  it('rejects a userinfo-obfuscated host', async () => {
    const result = await parse(
      'https://pay.walletconnect.com@evil.com/pay_123',
    );
    expect(result.type).not.toEqual(EQRCodeHandlerType.WALLET_CONNECT_PAY);
  });

  it('does not affect ethereum: URI parsing', async () => {
    const result = await parse(
      'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48@1?value=1000000',
    );
    expect(result.type).toEqual(EQRCodeHandlerType.ETHEREUM);
  });

  it('accepts a bare pay_ id', async () => {
    expect(await parse('pay_a1b2c3')).toEqual(
      expect.objectContaining({
        type: EQRCodeHandlerType.WALLET_CONNECT_PAY,
      }),
    );
  });

  it('rejects arbitrary text that merely contains a pay marker', async () => {
    // the SDK's isPaymentLink substring-matches pay_ / pay. / pay=
    const orderText = await parse('ORDER_PAY_2024');
    expect(orderText.type).not.toEqual(EQRCodeHandlerType.WALLET_CONNECT_PAY);
    const sentence = await parse('please pay. thanks');
    expect(sentence.type).not.toEqual(EQRCodeHandlerType.WALLET_CONNECT_PAY);
    const kvText = await parse('amount pay=100');
    expect(kvText.type).not.toEqual(EQRCodeHandlerType.WALLET_CONNECT_PAY);
  });
});
