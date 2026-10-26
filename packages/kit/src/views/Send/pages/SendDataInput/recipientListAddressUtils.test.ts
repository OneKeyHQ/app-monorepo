import {
  findLookalikeAddresses,
  formatRecipientExtra,
  getAddressPrefix,
  isLookalikeAddress,
  shortenRecipientAddress,
} from './recipientListAddressUtils';

/*
yarn jest packages/kit/src/views/Send/pages/SendDataInput/recipientListAddressUtils.test.ts
*/

const EVM_REAL = '0x96223d67518AAedcBed163098fA4BC3fa2384F4f';
// Same first 6 and last 6 after "0x": identical in short form.
const EVM_FAKE = '0x96223d0b3f1e9a2c77d41e58b0c2f9e6a1384F4f';

describe('getAddressPrefix', () => {
  it.each([
    [EVM_REAL, '0x'],
    ['bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'bc1'],
    ['cosmos1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu', 'cosmos1'],
    ['bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy', 'bitcoincash:'],
    ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', ''],
    ['r9cZA1mLK5R5Am25ArfXFmqgNwjZgnfk59', ''],
    ['7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV', ''],
  ])('%s → %s', (address, prefix) => {
    expect(getAddressPrefix(address)).toBe(prefix);
  });
});

describe('shortenRecipientAddress', () => {
  it.each([
    [EVM_REAL, '0x96223d...384F4f'],
    // 6 characters past a prefix, never fewer than 8 in total.
    ['bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'bc1qar0sr...wf5mdq'],
    ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', '1A1zP1eP...DivfNa'],
    ['cosmos1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu', 'cosmos1qypqxp...lzv7xu'],
    [
      'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy',
      'bitcoincash:qr95sy...verfuy',
    ],
    // Names stay whole.
    ['alice@getalby.com', 'alice@getalby.com'],
    ['alice.near', 'alice.near'],
    // Too short to save anything.
    ['0x1234567890abcde', '0x1234567890abcde'],
    ['', ''],
  ])('%s → %s', (address, short) => {
    expect(shortenRecipientAddress(address)).toBe(short);
  });
});

describe('findLookalikeAddresses', () => {
  it('flags both addresses of a lookalike pair', () => {
    const lookalikes = findLookalikeAddresses([
      EVM_REAL,
      EVM_FAKE,
      '0x73f46BB9410aa31bB9A0f3Ba1497bacC2a17D944',
    ]);
    expect(isLookalikeAddress(lookalikes, EVM_REAL)).toBe(true);
    expect(isLookalikeAddress(lookalikes, EVM_FAKE)).toBe(true);
    expect(
      isLookalikeAddress(
        lookalikes,
        '0x73f46BB9410aa31bB9A0f3Ba1497bacC2a17D944',
      ),
    ).toBe(false);
  });

  it('treats one EVM address in two cases as the same address', () => {
    const lookalikes = findLookalikeAddresses([
      EVM_REAL,
      EVM_REAL.toLowerCase(),
    ]);
    expect(lookalikes.size).toBe(0);
  });

  it('matches EVM lookalikes regardless of checksum case', () => {
    const lookalikes = findLookalikeAddresses([
      EVM_REAL,
      EVM_FAKE.toLowerCase(),
    ]);
    expect(isLookalikeAddress(lookalikes, EVM_FAKE)).toBe(true);
  });

  it('does not count a shared chain prefix as matching characters', () => {
    const lookalikes = findLookalikeAddresses([
      'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy',
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
      'celestia1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu',
      'celestia1w4m8z8shpf4lzjk2cq0yxr4yq5thuhvz0h2a3z',
    ]);
    expect(lookalikes.size).toBe(0);
  });

  it('flags lookalikes after a long prefix', () => {
    const lookalikes = findLookalikeAddresses([
      'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy',
      'bitcoincash:qr95sym0hmnf2qjvqvmn5y9x6yd0fw6t3e0qverfuy',
    ]);
    expect(lookalikes.size).toBe(2);
  });

  it('leaves names out', () => {
    const lookalikes = findLookalikeAddresses([
      'alice@getalby.com',
      'alice@getalbx.com',
    ]);
    expect(lookalikes.size).toBe(0);
  });
});

describe('formatRecipientExtra', () => {
  const labels = { tagLabel: 'Tag', noteLabel: 'Note' };

  it('labels a memo as the tag and keeps short values whole', () => {
    expect(formatRecipientExtra({ memo: '104523987', ...labels })).toBe(
      'Tag 104523987',
    );
  });

  it('labels a note and shortens long values', () => {
    expect(
      formatRecipientExtra({
        note: 'payment-for-invoice-2026-10',
        ...labels,
      }),
    ).toBe('Note paymen...6-10');
  });

  it('returns nothing without a memo or note', () => {
    expect(formatRecipientExtra(labels)).toBeUndefined();
  });
});
