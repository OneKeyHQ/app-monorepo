import {
  findLookalikeAddresses,
  formatRecipientExtra,
  getRecipientDetailText,
  isLookalikeAddress,
  looksLikeListedAddress,
  shortenRecipientAddress,
} from './recipientListAddressUtils';

/*
yarn jest packages/kit/src/views/Send/pages/SendDataInput/recipientListAddressUtils.test.ts
*/

const EVM_REAL = '0x96223d67518AAedcBed163098fA4BC3fa2384F4f';
// Same first 6 and last 6 after "0x": identical in short form.
const EVM_FAKE = '0x96223d0b3f1e9a2c77d41e58b0c2f9e6a1384F4f';
// A NEAR implicit account: hex with a "1" in it, which is not bech32.
const NEAR_IMPLICIT =
  'ead581ddd3387b1bbb64b7d621a660c11bd526cd2a48c8f87ba254cb391e398d';
// CKB full addresses with one lock script share their first 58 characters.
const CKB_FULL =
  'ckb1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2ty6ncud4dtpqks4fkjj36k7h729far7q724lt7';
const CKB_FULL_OTHER =
  'ckb1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqw2thjykus8hzg053mcq4dfhwmxdgwguqcprsuh7';
// Also ends like CKB_FULL.
const CKB_FULL_SAME_END =
  'ckb1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqws6ta4ce92ffcw49kxjd6em2mxygh95tc5evlt7';

describe('shortenRecipientAddress', () => {
  it.each([
    [EVM_REAL, '0x96223d...384F4f'],
    // 6 characters past a prefix, never fewer than 8 in total.
    ['bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'bc1qar0sr...wf5mdq'],
    ['BC1QAR0SRRR7XFKVY5L643LYDNW9RE59GTZZWF5MDQ', 'BC1QAR0SR...WF5MDQ'],
    ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', '1A1zP1eP...DivfNa'],
    [NEAR_IMPLICIT, 'ead581dd...1e398d'],
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
      'celestia1496sf6n0pcxxzlt8xgdm72yg0ndv33hm3fw5q3',
      'celestia1zg9gtvwjnc225yj73danwz54vgkgmnxkas0jxx',
    ]);
    expect(lookalikes.size).toBe(0);
  });

  it('does not flag addresses only for the start their format gives them', () => {
    expect(findLookalikeAddresses([CKB_FULL, CKB_FULL_OTHER]).size).toBe(0);
  });

  it('flags format-sharing addresses whose ends match too', () => {
    expect(findLookalikeAddresses([CKB_FULL, CKB_FULL_SAME_END]).size).toBe(2);
  });

  it('compares bech32 written in capitals with its lowercase form', () => {
    const lookalikes = findLookalikeAddresses([
      CKB_FULL,
      CKB_FULL_SAME_END.toUpperCase(),
    ]);
    expect(isLookalikeAddress(lookalikes, CKB_FULL)).toBe(true);
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

describe('looksLikeListedAddress', () => {
  const listed = [EVM_REAL, '0x73f46BB9410aa31bB9A0f3Ba1497bacC2a17D944'];

  it('flags a pasted lookalike of a listed address', () => {
    expect(looksLikeListedAddress(listed, EVM_FAKE)).toBe(true);
  });

  it('does not flag a listed address itself, in any case', () => {
    expect(looksLikeListedAddress(listed, EVM_REAL)).toBe(false);
    expect(looksLikeListedAddress(listed, EVM_REAL.toLowerCase())).toBe(false);
  });

  it('does not flag unrelated addresses or names', () => {
    expect(
      looksLikeListedAddress(
        listed,
        '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      ),
    ).toBe(false);
    expect(looksLikeListedAddress(listed, 'vitalik.eth')).toBe(false);
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

describe('getRecipientDetailText', () => {
  it('lists the details on one line with the tag between the leading parts and the time', () => {
    expect(
      getRecipientDetailText({
        address: EVM_REAL,
        extra: 'Tag 104523',
        showFullAddress: false,
        before: ['0x9622...384F4f', 'BNB Chain'],
        after: ['2d'],
      }),
    ).toEqual({
      text: '0x9622...384F4f · BNB Chain · Tag 104523 · 2d',
      isFullAddress: false,
    });
  });

  it('skips the parts a row does not have', () => {
    expect(
      getRecipientDetailText({
        address: EVM_REAL,
        showFullAddress: false,
        before: [undefined, 'Ethereum'],
        after: [undefined],
      }),
    ).toEqual({ text: 'Ethereum', isFullAddress: false });
    expect(
      getRecipientDetailText({ address: EVM_REAL, showFullAddress: false }),
    ).toEqual({ text: undefined, isFullAddress: false });
  });

  it('shows the full address with its tag while searching or for a lookalike', () => {
    expect(
      getRecipientDetailText({
        address: EVM_FAKE,
        extra: 'Note abc',
        showFullAddress: true,
        before: ['0x9622...384F4f'],
        after: ['2d'],
      }),
    ).toEqual({ text: `${EVM_FAKE} · Note abc`, isFullAddress: true });
  });
});
