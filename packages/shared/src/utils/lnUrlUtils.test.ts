import {
  getInvoiceAmountSats,
  isReusableLightningRecipient,
  normalizeLightningInput,
} from './lnUrlUtils';

// The first BOLT 11 example invoice and the LUD-01 example LNURL.
const INVOICE =
  'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql';
const LNURL =
  'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns';

describe('normalizeLightningInput', () => {
  it.each([
    ['a bare invoice', INVOICE, INVOICE],
    ['lightning:<invoice>', `lightning:${INVOICE}`, INVOICE],
    ['an upper case QR code', `lightning:${INVOICE}`.toUpperCase(), INVOICE],
    ['lightning://<invoice>', `lightning://${INVOICE}`, INVOICE],
    ['an upper case LNURL', `lightning:${LNURL.toUpperCase()}`, LNURL],
    [
      'a lightning address',
      ' lightning:Satoshi@example.com ',
      'Satoshi@example.com',
    ],
  ])('reduces %s to what it carries', (_label, input, expected) => {
    expect(normalizeLightningInput(input)).toBe(expected);
  });

  it('leaves a mixed case invoice for the decoder to reject', () => {
    const mixedCase = `L${INVOICE.slice(1)}`;
    expect(normalizeLightningInput(`lightning:${mixedCase}`)).toBe(mixedCase);
  });

  it('only strips the scheme at the start of the input', () => {
    const text = `pay lightning:${INVOICE}`;
    expect(normalizeLightningInput(text)).toBe(text);
  });

  it('lets a lightning address behind the scheme count as reusable', () => {
    const input = 'lightning:satoshi@example.com';
    expect(isReusableLightningRecipient(input)).toBe(false);
    expect(isReusableLightningRecipient(normalizeLightningInput(input))).toBe(
      true,
    );
  });
});

describe('getInvoiceAmountSats', () => {
  it.each([
    ['500', 1],
    ['1500', 2],
    ['2000', 2],
  ])(
    'rounds %s msat up to %i sat for self-custody Lightning',
    (millisatoshis, sats) => {
      expect(
        getInvoiceAmountSats({ satoshis: 0, millisatoshis, roundUp: true }),
      ).toBe(sats);
    },
  );

  it('keeps the custodial rounding down', () => {
    expect(getInvoiceAmountSats({ millisatoshis: '500', roundUp: false })).toBe(
      0,
    );
    expect(
      getInvoiceAmountSats({
        satoshis: 5,
        millisatoshis: '5000',
        roundUp: false,
      }),
    ).toBe(5);
  });

  it('has no amount for a zero-amount invoice', () => {
    expect(getInvoiceAmountSats({ roundUp: true })).toBeUndefined();
  });
});
