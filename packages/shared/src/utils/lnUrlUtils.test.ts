import { bech32 } from 'bech32';

import {
  findLnurl,
  isAmbiguousLnurl,
  isReusableLightningRecipient,
  normalizeLightningInput,
  parseReusableLightningRecipient,
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
  expect(parseReusableLightningRecipient(paymentText)).toEqual({
    kind: 'recipient',
    address: LNURL,
  });
  expect(isReusableLightningRecipient(paymentText)).toBe(false);
  expect(
    parseReusableLightningRecipient(`Email: ${LNURL}@example.com`),
  ).toBeUndefined();
});

it('excludes a surrounding wrapper and adjacent sentence punctuation', () => {
  expect(
    parseReusableLightningRecipient('Pay here: (lnurlp://example.com/pay).'),
  ).toEqual({ kind: 'recipient', address: 'lnurlp://example.com/pay' });
  expect(parseReusableLightningRecipient(`请支付 ${LNURL}。`)).toEqual({
    kind: 'recipient',
    address: LNURL,
  });
  expect(parseReusableLightningRecipient(`请支付：${LNURL}。`)).toEqual({
    kind: 'recipient',
    address: LNURL,
  });
  expect(parseReusableLightningRecipient(`Pay:${LNURL}`)).toEqual({
    kind: 'recipient',
    address: LNURL,
  });
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
  'Pay: (lnurlp://merchant.example/checkout?order=12 &item=34)',
  'Pay: (lnurlp://merchant.example/checkout?order=12 #payment)',
  'Pay: lnurlp://merchant.example/checkout?order=12 &item=34',
  '(lnurlp://merchant.example/checkout?order=12\n)34)',
  '(lnurlp://merchant.example/checkout?order=12\n),34)',
  '(lnurlp://merchant.example/checkout?order=12\n)—34)',
  '(lnurlp://merchant.example/checkout?order=12\n)—\n34)',
  '(lnurlp://merchant.example/checkout?order=12\r\n)— \r\n&item=7)',
  '(lnurlp://merchant.example/checkout?order=12\u2028)—\u202934)',
  'Pay: lnurlp://merchant.example/checkout?order=12\t34',
  'Pay: lnurlp://merchant.example/checkout?order=12\t34 for this order',
  'Pay: lnurlp://merchant.example/checkout?order=12\tAB34 Keep the receipt',
  'Pay: lnurlp://merchant.example/checkout?order=12\tOrder34',
  'lnurlp://merchant.example/checkout?order=12\tOrder:AB34&item=7',
  'lnurlp://merchant.example/checkout?order=12\tOrder:34&amount=1000',
  'lnurlp://merchant.example/checkout?order=12\tORDER:AB34',
  'lnurlp://merchant.example/checkout?order=12\t订单：34',
  'lnurlp://merchant.example/checkout?order=12\t订单号：34&item=7',
  'lnurlp://merchant.example/checkout?order=12\t—',
  'lnurlp://merchant.example/checkout?order=12\t—\tPaid',
  'lnurlp://merchant.example/checkout?order=12\t— \t Paid',
  'Pay: (lnurlp://merchant.example/checkout?order=12\t34)',
])('rejects an LNURL with an ambiguous continuation', (text) => {
  expect(isAmbiguousLnurl(text)).toBe(true);
  expect(parseReusableLightningRecipient(text)).toEqual({ kind: 'ambiguous' });
});

it.each([
  'lnurlp://example.com/pay\n\nThanks',
  '请支付：lnurlp://example.com/pay  \r\n\t\r\nThanks for your order.',
])('keeps a complete LNURL before a blank line', (input) => {
  expect(isAmbiguousLnurl(input)).toBe(false);
  expect(parseReusableLightningRecipient(input)).toEqual({
    kind: 'recipient',
    address: 'lnurlp://example.com/pay',
  });
});

it('uses explicit wrappers and checksum validation as recipient boundaries', () => {
  const uri = 'lnurlp://merchant.example/checkout?order=12';
  for (const token of [`(${uri})`, `<${uri}>`, `"${uri}"`, `'${uri}'`, LNURL]) {
    const text = `Pay:\n${token}\n34`;
    expect(isAmbiguousLnurl(text)).toBe(false);
    expect(parseReusableLightningRecipient(text)).toEqual({
      kind: 'recipient',
      address: token === LNURL ? LNURL : uri,
    });
  }
});

it('preserves a wrapped link when only whitespace separates it from the closer', () => {
  const uri = 'lnurlp://example.com/pay';
  expect(parseReusableLightningRecipient(`<${uri}\n\n>\nThanks`)).toEqual({
    kind: 'recipient',
    address: uri,
  });
  expect(parseReusableLightningRecipient(`Pay (${uri}\n).\nThanks`)).toEqual({
    kind: 'recipient',
    address: uri,
  });
});

it('keeps a wrapped LNURL when an em dash introduces prose after its closer', () => {
  const uri = 'lnurlp://merchant.example/checkout?order=12';
  expect(
    parseReusableLightningRecipient(`Pay (${uri}\n)— keep the receipt.`),
  ).toEqual({ kind: 'recipient', address: uri });
});

it('keeps an LNURL when an explicit wrapper closes before a tab', () => {
  const uri = 'lnurlp://merchant.example/checkout?order=12';
  expect(
    parseReusableLightningRecipient(`Pay: (${uri})\tKeep the receipt.`),
  ).toEqual({ kind: 'recipient', address: uri });
});

it('keeps an explicitly bounded LNURL beside a spreadsheet placeholder', () => {
  const uri = 'lnurlp://merchant.example/checkout?order=12—';
  for (const cells of ['—', '—\tPaid']) {
    expect(parseReusableLightningRecipient(`<${uri}>\t${cells}`)).toEqual({
      kind: 'recipient',
      address: uri,
    });
  }
});

it.each([
  'Order #34',
  'Order 34',
  'Order: AB34',
  'Order ID: AB34',
  '订单： 34',
])('keeps a complete LNURL in a spreadsheet row labelled %s', (label) => {
  const uri = 'lnurlp://merchant.example/checkout?order=12';
  expect(parseReusableLightningRecipient(`${uri}\t${label}`)).toEqual({
    kind: 'recipient',
    address: uri,
  });
});

it('extracts a complete link followed by prose in the same parenthetical', () => {
  const uri = 'lnurlp://example.com/pay?note=thanks!';
  expect(
    parseReusableLightningRecipient(`Pay (${uri} before Friday).`),
  ).toEqual({ kind: 'recipient', address: uri });
  expect(
    parseReusableLightningRecipient(`Pay (${uri}) &check your receipt.`),
  ).toEqual({ kind: 'recipient', address: uri });
});

it('recognizes the outer parenthesis before attached punctuation and prose', () => {
  const uri = 'lnurlp://example.com/pay(weekly)';
  expect(
    parseReusableLightningRecipient(`Pay (${uri}),then retry (if needed).`),
  ).toEqual({ kind: 'recipient', address: uri });
  expect(parseReusableLightningRecipient(`Pay (${uri})\nThanks`)).toEqual({
    kind: 'recipient',
    address: uri,
  });
});

it('keeps literal closing parentheses inside a clearly wrapped URI', () => {
  const uri = 'lnurlp://merchant.example/pay)weekly?order=1234';
  expect(parseReusableLightningRecipient(`Pay (${uri}).`)).toEqual({
    kind: 'recipient',
    address: uri,
  });
});

it.each([
  [
    'Please pay (use this link (lnurlp://merchant.example/pay)).',
    'lnurlp://merchant.example/pay',
  ],
  [
    'Please pay (use this link (lnurlp://merchant.example/pay)).\n1) Keep the receipt.',
    'lnurlp://merchant.example/pay',
  ],
  [
    'Please pay (use (lnurlp://merchant.example/pay) before Friday).\n1) Keep the receipt.',
    'lnurlp://merchant.example/pay',
  ],
  [
    'Please pay (use (lnurlp://merchant.example/pay) before Friday).\r\n1) Keep the receipt.\r\n2) Print the receipt.',
    'lnurlp://merchant.example/pay',
  ],
  [
    'Please pay (the invoice (use (lnurlp://merchant.example/pay)weekly?order=1234)) before Friday).\n1) Keep the receipt.',
    'lnurlp://merchant.example/pay)weekly?order=1234',
  ],
  [
    'Please pay (the invoice (link (lnurlp://merchant.example/pay)weekly?order=1234))).',
    'lnurlp://merchant.example/pay)weekly?order=1234',
  ],
])('uses the link wrapper inside enclosing prose parentheses', (text, uri) => {
  expect(isAmbiguousLnurl(text)).toBe(false);
  expect(parseReusableLightningRecipient(text)).toEqual({
    kind: 'recipient',
    address: uri,
  });
});

it('keeps a trailing literal parenthesis when the link has an explicit angle wrapper', () => {
  const uri = 'lnurlp://merchant.example/checkout?order=12)';
  expect(
    parseReusableLightningRecipient(`Pay <${uri}>\n123) before Friday.`),
  ).toEqual({ kind: 'recipient', address: uri });
});

it.each([
  '(lnurlp://merchant.example/pay),weekly)',
  'Pay (lnurlp://merchant.example/pay),weekly before Friday).',
  'Pay (use this link (lnurlp://merchant.example/pay),weekly before Friday) if needed).',
  'Please pay (use (lnurlp://merchant.example/checkout?order=12),34)\nby Friday).',
  'Please pay (use (lnurlp://merchant.example/checkout?order=12),34)\n\nby Friday).',
  'Please pay (use (lnurlp://merchant.example/checkout)?order=12)\nby Friday).',
  'Please pay (use (lnurlp://merchant.example/pay?ref=12),34) for order\n123) before Friday.',
  'Please pay (use (lnurlp://merchant.example/pay?ref=12),34) for order\n  123) before Friday.',
  'Please pay (use (lnurlp://merchant.example/pay?ref=12),34) for order (before Friday).\n123) Keep the receipt.',
  'Please pay (use (lnurlp://merchant.example/checkout?order=12))\n123) before Friday.',
  'Please pay (use (lnurlp://merchant.example/checkout?order=12)).\n123) before Friday.',
  'Please pay (use (lnurlp://merchant.example/checkout?order=12))\n1) before Friday.',
])('rejects a wrapper with two plausible closing parentheses', (text) => {
  expect(isAmbiguousLnurl(text)).toBe(true);
  expect(parseReusableLightningRecipient(text)).toEqual({ kind: 'ambiguous' });
});

it.each([
  'lnurlp://merchant.example/checkout?order=1234',
  'lnurlp://merchant.example/checkout)weekly?order=1234',
])(
  'keeps the complete recipient when unambiguous enclosing prose spans lines',
  (uri) => {
    expect(
      parseReusableLightningRecipient(`Please pay (use (${uri})\nby Friday).`),
    ).toEqual({ kind: 'recipient', address: uri });
  },
);

it('rejects multiple distinct LNURL destinations in payment instructions', () => {
  const orderA = 'lnurlp://merchant.example/pay?order=1';
  const orderB = 'lnurlp://merchant.example/pay?order=2';
  const several = `Pay (${orderA}) or (${orderB}).`;
  expect(isAmbiguousLnurl(several)).toBe(true);
  expect(parseReusableLightningRecipient(several)).toEqual({
    kind: 'ambiguous',
  });
  expect(
    parseReusableLightningRecipient(`Pay (${orderA}) or <${orderA}>.`),
  ).toEqual({ kind: 'recipient', address: orderA });
  const otherCode = bech32.encode(
    'lnurl',
    bech32.toWords(Buffer.from('https://merchant.example/pay?order=3')),
  );
  expect(isAmbiguousLnurl(`Pay (${LNURL}) or (${otherCode}).`)).toBe(true);
});

it.each([
  '<lnu\nrlp://merchant.example/checkout?order=1>;lnurlp://merchant.example/checkout?order=2',
  '<lnurlp://merchant.example/checkout?order=2>; <LNURL\r\nP://merchant.example/checkout?order=1>',
  '<lnurlp://merchant.example/checkout?order=2>; <lnu\u2028rlp://merchant.example/checkout?order=1>',
])(
  'rejects a complete LNURL beside a different address with a split scheme',
  (text) => {
    expect(isAmbiguousLnurl(text)).toBe(true);
    expect(parseReusableLightningRecipient(text)).toEqual({
      kind: 'ambiguous',
    });
  },
);

it('keeps the original complete link when a split duplicate has the same destination', () => {
  const uri = 'lnurlp://merchant.example/checkout?order=2';
  const text = `<LNURL\nP://merchant.example/checkout?order=2>;${uri}`;
  expect(parseReusableLightningRecipient(text)).toEqual({
    kind: 'recipient',
    address: uri,
  });
});

it.each(['\n', '\r\n', '\u2028', '\u2029'])(
  'rejects a different checksum-valid LNURL wrapped beside a complete recipient',
  (lineBreak) => {
    const uri = 'lnurlp://merchant.example/checkout?order=12';
    const wrapped = `${LNURL.slice(0, 32)}${lineBreak}${LNURL.slice(32, 75)}${lineBreak}${LNURL.slice(75)}`;
    for (const text of [
      `Pay <${wrapped}> or <${uri}>.`,
      `Pay <lightning://${wrapped}> or <${uri}>.`,
      `<${uri}>; ${wrapped.toUpperCase()}\nThanks.`,
    ]) {
      expect(parseReusableLightningRecipient(text)).toEqual({
        kind: 'ambiguous',
      });
    }
  },
);

it('preserves a complete Bech32 recipient when a wrapped duplicate or corrupt code also appears', () => {
  const wrapped = `${LNURL.slice(0, 32)}\n${LNURL.slice(32)}`;
  for (const second of [wrapped.toUpperCase(), `${wrapped.slice(0, -1)}q`]) {
    expect(parseReusableLightningRecipient(`<${LNURL}>; <${second}>`)).toEqual({
      kind: 'recipient',
      address: LNURL,
    });
  }
});

it('compares LNURL scheme casing without folding the path or query', () => {
  const uri = 'lnurlp://merchant.example/Pay?ref=ABC';
  const equivalent = 'LNURLP://merchant.example/Pay?ref=ABC';
  expect(
    parseReusableLightningRecipient(`Pay <${uri}> or <${equivalent}>.`),
  ).toEqual({ kind: 'recipient', address: uri });
  expect(
    isAmbiguousLnurl(`Pay <${uri}> or <${equivalent.replace('ABC', 'abc')}>.`),
  ).toBe(true);
});

it.each([';', '；'])(
  'counts checksum-validated LNURLs next to the %s delimiter',
  (separator) => {
    const uri = 'lnurlp://merchant.example/pay';
    expect(
      parseReusableLightningRecipient(`Pay ${LNURL}${separator} or <${uri}>.`),
    ).toEqual({ kind: 'ambiguous' });
    expect(
      parseReusableLightningRecipient(`Pay ${LNURL}${separator}${uri}`),
    ).toEqual({ kind: 'ambiguous' });
    expect(
      parseReusableLightningRecipient(
        `Pay ${LNURL}${separator} details follow`,
      ),
    ).toEqual({ kind: 'recipient', address: LNURL });
  },
);

it.each([
  'Pay lnu\nrlp://merchant.example/pay',
  'Pay here: <LIGHTNING:LNURL\r\nP://merchant.example/pay>',
])('rejects %s when line-break removal would create an LNURL URI', (text) => {
  expect(isAmbiguousLnurl(text)).toBe(true);
  expect(parseReusableLightningRecipient(text)).toEqual({ kind: 'ambiguous' });
});

it('keeps repeated wrapped references to one LNURL in long payment instructions', () => {
  const uri = 'lnurlp://merchant.example/checkout?order=12';
  const text = `Please pay (${`(${uri}) then `.repeat(512)}save the receipt).`;
  expect(parseReusableLightningRecipient(text)).toEqual({
    kind: 'recipient',
    address: uri,
  });
});

it.each(['lnurlp://example.com/pay.', 'lnurlp://example.com/pay?note=thanks!'])(
  'preserves the entire URI when pasted without a wrapper: %s',
  (uri) => {
    expect(parseReusableLightningRecipient(`Pay here: ${uri}`)).toEqual({
      kind: 'recipient',
      address: uri,
    });
  },
);

it('preserves punctuation within the URI when stripping an outer wrapper', () => {
  const uri = 'lnurlp://example.com/pay(weekly)?note=thanks!';
  expect(parseReusableLightningRecipient(`Pay here: (${uri}).`)).toEqual({
    kind: 'recipient',
    address: uri,
  });
});

it('preserves punctuation inside standalone or explicitly delimited LNURL URIs', () => {
  const uri = 'lnurlp://example.com/pay(weekly)?note=thanks!';
  expect(parseReusableLightningRecipient(uri)).toEqual({
    kind: 'recipient',
    address: uri,
  });
  expect(parseReusableLightningRecipient(`Pay here: "${uri}".`)).toEqual({
    kind: 'recipient',
    address: uri,
  });
  expect(parseReusableLightningRecipient(`Pay here: '${uri}'.`)).toEqual({
    kind: 'recipient',
    address: uri,
  });
});
