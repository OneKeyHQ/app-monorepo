import { createIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  buildTelegramShareUrl,
  getReferralShareCopy,
} from './referralShareCopy';

const intl = createIntl({
  locale: 'en',
  messages: jest.requireActual('@onekeyhq/shared/src/locale/json/en_US.json'),
});

describe('getReferralShareCopy', () => {
  it('leads with the invitee discount when there is one', () => {
    const copy = getReferralShareCopy(intl, '10%');
    expect(copy.headlineId).toBe(ETranslations.referral_share_headline__title);
    expect(copy.rate).toBe('10%');
    expect(copy.shareText).toBe(
      'Join me on OneKey and get up to 10% off fees.',
    );
  });

  it.each([null, undefined, ''])(
    'falls back to a plain invitation without a discount (%p)',
    (rate) => {
      const copy = getReferralShareCopy(intl, rate);
      expect(copy.rate).toBeUndefined();
      expect(copy.headlineId).toBe(
        ETranslations.referral_share_headline_plain__title,
      );
      expect(copy.shareText).toBe('Join me on OneKey.');
    },
  );
});

describe('buildTelegramShareUrl', () => {
  const url = 'https://onekey.so/r/HTSEO7?a=1&b=2';
  const text = 'Join me on OneKey & save';

  it('passes the link and the text separately to Telegram', () => {
    const shareUrl = new URL(buildTelegramShareUrl(text, url));
    expect(shareUrl.origin + shareUrl.pathname).toBe('https://t.me/share/url');
    expect(shareUrl.searchParams.get('url')).toBe(url);
    expect(shareUrl.searchParams.get('text')).toBe(text);
  });
});
