import {
  buildTelegramShareUrl,
  buildXShareUrl,
  getReferralShareCopy,
} from './referralShareCopy';

describe('getReferralShareCopy', () => {
  it('leads with the invitee discount when there is one', () => {
    const copy = getReferralShareCopy('10%');
    expect(
      `${copy.headlineLead}${copy.headlineRate ?? ''}${copy.headlineTail}`,
    ).toBe('Get up to 10% off fees on OneKey');
    expect(copy.headlineRate).toBe('10%');
    expect(copy.shareText).toBe(
      'Join me on OneKey and get up to 10% off fees.',
    );
  });

  it.each([null, undefined, ''])(
    'falls back to a plain invitation without a discount (%p)',
    (rate) => {
      const copy = getReferralShareCopy(rate);
      expect(copy.headlineRate).toBeUndefined();
      expect(`${copy.headlineLead}${copy.headlineTail}`).toBe(
        'Join me on OneKey',
      );
      expect(copy.shareText).toBe('Join me on OneKey.');
    },
  );
});

describe('share URLs', () => {
  const url = 'https://onekey.so/r/HTSEO7?a=1&b=2';
  const text = 'Join me on OneKey & save';

  it('puts the text and the link in the X intent', () => {
    const shareUrl = new URL(buildXShareUrl(text, url));
    expect(shareUrl.origin + shareUrl.pathname).toBe(
      'https://x.com/intent/tweet',
    );
    expect(shareUrl.searchParams.get('text')).toBe(`${text}\n\n${url}`);
  });

  it('passes the link and the text separately to Telegram', () => {
    const shareUrl = new URL(buildTelegramShareUrl(text, url));
    expect(shareUrl.origin + shareUrl.pathname).toBe('https://t.me/share/url');
    expect(shareUrl.searchParams.get('url')).toBe(url);
    expect(shareUrl.searchParams.get('text')).toBe(text);
  });
});
