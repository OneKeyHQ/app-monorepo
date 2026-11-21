import { bech32 } from 'bech32';

import {
  findLnurl,
  isAmbiguousLnurl,
  isReusableLightningRecipient,
  normalizeLightningInput,
  resolveReusableLightningRecipient,
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

it('does not extract LNURL text from an invoice', () => {
  const invoice = INVOICE.replace('pvjluez', 'lnurlqq');
  expect(findLnurl(invoice)).toBeNull();
  expect(isReusableLightningRecipient(invoice)).toBe(false);
});

it('does not extract the username from a Lightning Address', () => {
  expect(findLnurl('LNURLalice@example.com')).toBeNull();
  expect(isReusableLightningRecipient('LNURLalice@example.com')).toBe(true);
});

it('requires the exact LNURL prefix and a nonempty payload', () => {
  expect(findLnurl(bech32.encode('lnurl1other', [1]))).toBeNull();
  expect(findLnurl(bech32.encode('lnurl', []))).toBeNull();
});

it('extracts a complete LNURL from pasted text while keeping QR recognition strict', () => {
  const paymentText = `Pay here: (${LNURL.toUpperCase()}).`;
  expect(resolveReusableLightningRecipient(paymentText)).toBe(LNURL);
  expect(isReusableLightningRecipient(paymentText)).toBe(false);
  expect(
    resolveReusableLightningRecipient(`Email: ${LNURL}@example.com`),
  ).toBeNull();
});

it('excludes a surrounding wrapper and adjacent sentence punctuation', () => {
  expect(
    resolveReusableLightningRecipient('Pay here: (lnurlp://example.com/pay).'),
  ).toBe('lnurlp://example.com/pay');
  expect(resolveReusableLightningRecipient(`请支付 ${LNURL}。`)).toBe(LNURL);
  expect(resolveReusableLightningRecipient(`请支付：${LNURL}。`)).toBe(LNURL);
  expect(resolveReusableLightningRecipient(`Pay:${LNURL}`)).toBe(LNURL);
});

it.each([
  'Pay:\nlnurlp://merchant.example/checkout?order=12\n34',
  'Pay here:\r\nLIGHTNING:lnurlp://merchant.example/checkout?order=12\r\n  34',
  '请支付：lnurlp://merchant.example/checkout?order=12 \t\n34',
  'lnurlp://merchant.example/checkout?order=12 \r\n34',
  'Pay: lnurlp://merchant.example/checkout?order=12\u202834',
  'Pay: lnurlp://merchant.example/checkout?order=12\u202934',
  '<lnurlp://merchant.example/checkout?order=12\n\n34>',
  'Pay:\n"lnurlp://merchant.example/checkout?order=12\r\n \r\n34"',
  'Pay: (lnurlp://merchant.example/checkout?order=12\u2028\u202934)',
  '(lnurlp://merchant.example/pay(weekly)\n?order=1234)',
  'lnurlp://merchant.example/checkout?order=12\n\n&invoice=34',
  'Pay: lnurlp://merchant.example/checkout\r\n \r\n?invoice=34',
])(
  'rejects an open-ended LNURL that could continue on the next line',
  (text) => {
    expect(isAmbiguousLnurl(text)).toBe(true);
    expect(resolveReusableLightningRecipient(text)).toBeNull();
  },
);

it.each([
  'lnurlp://example.com/pay\n\nThanks',
  '请支付：lnurlp://example.com/pay  \r\n\t\r\nThanks for your order.',
])('keeps a complete LNURL before a blank line', (input) => {
  expect(isAmbiguousLnurl(input)).toBe(false);
  expect(resolveReusableLightningRecipient(input)).toBe(
    'lnurlp://example.com/pay',
  );
});

it('uses explicit wrappers and checksum validation as recipient boundaries', () => {
  const uri = 'lnurlp://merchant.example/checkout?order=12';
  for (const token of [`(${uri})`, `<${uri}>`, `"${uri}"`, `'${uri}'`, LNURL]) {
    const text = `Pay:\n${token}\n34`;
    expect(isAmbiguousLnurl(text)).toBe(false);
    expect(resolveReusableLightningRecipient(text)).toBe(
      token === LNURL ? LNURL : uri,
    );
  }
});

it('preserves a wrapped link when only whitespace separates it from the closer', () => {
  const uri = 'lnurlp://example.com/pay';
  expect(resolveReusableLightningRecipient(`<${uri}\n\n>\nThanks`)).toBe(uri);
});

it('extracts a complete link followed by prose in the same parenthetical', () => {
  const uri = 'lnurlp://example.com/pay?note=thanks!';
  expect(resolveReusableLightningRecipient(`Pay (${uri} before Friday).`)).toBe(
    uri,
  );
});

it('recognizes the outer parenthesis before attached punctuation and prose', () => {
  const uri = 'lnurlp://example.com/pay(weekly)';
  expect(
    resolveReusableLightningRecipient(`Pay (${uri}),then retry (if needed).`),
  ).toBe(uri);
  expect(resolveReusableLightningRecipient(`Pay (${uri})\nThanks`)).toBe(uri);
});

it('keeps literal closing parentheses inside a clearly wrapped URI', () => {
  const uri = 'lnurlp://merchant.example/pay)weekly?order=1234';
  expect(resolveReusableLightningRecipient(`Pay (${uri}).`)).toBe(uri);
});

it.each([
  '(lnurlp://merchant.example/pay),weekly)',
  'Pay (lnurlp://merchant.example/pay),weekly before Friday).',
])('rejects a wrapper with two plausible closing parentheses', (text) => {
  expect(isAmbiguousLnurl(text)).toBe(true);
  expect(resolveReusableLightningRecipient(text)).toBeNull();
});

it.each(['lnurlp://example.com/pay.', 'lnurlp://example.com/pay?note=thanks!'])(
  'preserves the entire URI when pasted without a wrapper: %s',
  (uri) => {
    expect(resolveReusableLightningRecipient(`Pay here: ${uri}`)).toBe(uri);
  },
);

it('preserves punctuation within the URI when stripping an outer wrapper', () => {
  const uri = 'lnurlp://example.com/pay(weekly)?note=thanks!';
  expect(resolveReusableLightningRecipient(`Pay here: (${uri}).`)).toBe(uri);
});

it('preserves punctuation inside standalone or explicitly delimited LNURL URIs', () => {
  const uri = 'lnurlp://example.com/pay(weekly)?note=thanks!';
  expect(resolveReusableLightningRecipient(uri)).toBe(uri);
  expect(resolveReusableLightningRecipient(`Pay here: "${uri}".`)).toBe(uri);
  expect(resolveReusableLightningRecipient(`Pay here: '${uri}'.`)).toBe(uri);
});
