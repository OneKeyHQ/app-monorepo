import {
  recipientIdentityRow,
  recipientWalletAccountTitle,
} from './recipientNativeList';

/*
yarn jest packages/kit/src/views/Send/pages/SendDataInput/recipientNativeList.test.ts
*/

const ADDRESS = '0x96223d67518AAedcBed163098fA4BC3fa2384F4f';

describe('recipientWalletAccountTitle', () => {
  it('lets the wallet give way and caps the account at 70% of the line', () => {
    const { title, titleSegments } = recipientWalletAccountTitle({
      walletName: 'Main wallet',
      accountName: 'Account #1',
      keepWalletName: false,
    });

    expect(title).toBe('Main wallet / Account #1');
    expect(titleSegments).toEqual([
      {
        text: 'Main wallet',
        tone: 'secondary',
        fontWeight: 'regular',
        shrink: true,
        maxWidthRatio: undefined,
      },
      { text: ' / ', tone: 'secondary', fontWeight: 'regular' },
      {
        text: 'Account #1',
        tone: 'primary',
        fontWeight: 'medium',
        shrink: false,
        maxWidthRatio: 0.7,
      },
    ]);
  });

  it('keeps the wallet whole and lets the account give way when the wallet matters', () => {
    const { titleSegments } = recipientWalletAccountTitle({
      walletName: 'Watch-only',
      accountName: 'Account #1',
      keepWalletName: true,
    });

    expect(titleSegments?.[0]).toMatchObject({
      shrink: false,
      maxWidthRatio: 0.7,
    });
    expect(titleSegments?.[2]).toMatchObject({
      shrink: true,
      maxWidthRatio: undefined,
    });
  });
});

describe('recipientIdentityRow', () => {
  it('titles an unnamed address with its short form and keeps the details to one line', () => {
    const row = recipientIdentityRow({
      key: 'a',
      address: ADDRESS,
      secondary: 'Ethereum · 2d',
    });

    expect(row.title).toBe('0x96223d...384F4f');
    expect(row.subtitle).toBe('Ethereum · 2d');
    expect(row.subtitleLines).toBe(1);
    expect(row.style?.image).toMatchObject({ width: 32, height: 32 });
  });

  it('wraps the full address and carries the title runs and glyph it is given', () => {
    const row = recipientIdentityRow({
      key: 'b',
      address: ADDRESS,
      name: 'Alice',
      secondary: ADDRESS,
      isFullAddress: true,
      titleLeadingIcon: { name: 'BookOpenOutline' },
      ...recipientWalletAccountTitle({
        walletName: 'Main wallet',
        accountName: 'Account #1',
        keepWalletName: false,
      }),
    });

    expect(row.subtitleLines).toBe(0);
    expect(row.title).toBe('Main wallet / Account #1');
    expect(row.titleSegments).toHaveLength(3);
    expect(row.titleLeadingIcon).toEqual({ name: 'BookOpenOutline' });
  });
});
