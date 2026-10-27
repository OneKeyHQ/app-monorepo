import fs from 'fs';
import path from 'path';

import { createIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  buildReceiveTitleLogo,
  resolveReceiveTitleIconURI,
} from './receiveTitleUtils';

const LOCALE_DIR = path.resolve(
  __dirname,
  '../../../../../shared/src/locale/json',
);

// The real title strings, one per locale, so a translation that moves or
// drops the token placeholder shows up here.
const TITLE_TEMPLATES = fs
  .readdirSync(LOCALE_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => {
    const messages = JSON.parse(
      fs.readFileSync(path.join(LOCALE_DIR, file), 'utf8'),
    ) as Record<string, string>;
    return {
      locale: file.replace('.json', ''),
      template: messages.receive_token__title,
    };
  });

// The formatter the page uses, so the stand-in for the token is known to
// come back out of it untouched.
const formatWith = (template: string) => {
  const intl = createIntl({
    locale: 'en',
    messages: { [ETranslations.receive_token__title]: template } as Record<
      string,
      string
    >,
  });
  return (token: string) =>
    intl.formatMessage({ id: ETranslations.receive_token__title }, { token });
};

const logoFor = (locale: string) => {
  const entry = TITLE_TEMPLATES.find((item) => item.locale === locale);
  return buildReceiveTitleLogo({
    uri: 'usdt.png',
    symbol: 'USDT',
    formatTitle: formatWith(entry?.template ?? ''),
  });
};

describe('buildReceiveTitleLogo', () => {
  it('covers every shipped locale', () => {
    expect(TITLE_TEMPLATES.length).toBeGreaterThanOrEqual(19);
  });

  it.each(TITLE_TEMPLATES)(
    'splits the $locale title around the symbol without losing text',
    ({ template }) => {
      const logo = buildReceiveTitleLogo({
        uri: 'usdt.png',
        symbol: 'USDT',
        formatTitle: formatWith(template),
      });

      expect(logo).toBeDefined();
      const gap = logo?.hasGap ? ' ' : '';
      const words = [logo?.before, logo?.symbol, logo?.after].filter(Boolean);
      expect(words.join(gap)).toBe(formatWith(template)('USDT'));
    },
  );

  it('keeps the symbol last where the locale ends with it', () => {
    expect(logoFor('en_US')).toEqual({
      uri: 'usdt.png',
      symbol: 'USDT',
      before: 'Receive',
      after: '',
      hasGap: true,
    });
  });

  it('keeps the symbol first where the locale leads with it', () => {
    for (const locale of ['ja_JP', 'ko_KR', 'hi_IN', 'bn']) {
      const logo = logoFor(locale);
      expect(logo?.before).toBe('');
      expect(logo?.after).not.toBe('');
    }
  });

  it('spaces the blocks apart only where the sentence has a space', () => {
    // "USDTを受け取る": the particle follows the symbol directly
    expect(logoFor('ja_JP')?.hasGap).toBe(false);
    // "USDT 받기"
    expect(logoFor('ko_KR')).toMatchObject({ after: '받기', hasGap: true });
  });

  it('gives a plain title without a logo or a symbol', () => {
    const formatTitle = formatWith('Receive {token}');
    expect(
      buildReceiveTitleLogo({ uri: undefined, symbol: 'USDT', formatTitle }),
    ).toBeUndefined();
    expect(
      buildReceiveTitleLogo({ uri: '', symbol: 'USDT', formatTitle }),
    ).toBeUndefined();
    expect(
      buildReceiveTitleLogo({ uri: 'usdt.png', symbol: '', formatTitle }),
    ).toBeUndefined();
  });

  it('gives a plain title when the sentence has no single place for the logo', () => {
    expect(
      buildReceiveTitleLogo({
        uri: 'usdt.png',
        symbol: 'USDT',
        formatTitle: formatWith('Receiving address'),
      }),
    ).toBeUndefined();
    expect(
      buildReceiveTitleLogo({
        uri: 'usdt.png',
        symbol: 'USDT',
        formatTitle: formatWith('Receive {token} ({token})'),
      }),
    ).toBeUndefined();
  });
});

describe('resolveReceiveTitleIconURI', () => {
  it('shows the logo of the token the page was opened with', () => {
    expect(
      resolveReceiveTitleIconURI({
        isNetworkEntry: false,
        tokenLogoURI: 'token.png',
      }),
    ).toBe('token.png');
  });

  it('shows none on a page entered by network', () => {
    expect(
      resolveReceiveTitleIconURI({
        isNetworkEntry: true,
        tokenLogoURI: 'token.png',
      }),
    ).toBeUndefined();
  });

  it('shows none without a token or for a token without a logo', () => {
    expect(
      resolveReceiveTitleIconURI({ isNetworkEntry: false }),
    ).toBeUndefined();
    expect(
      resolveReceiveTitleIconURI({ isNetworkEntry: false, tokenLogoURI: '' }),
    ).toBeUndefined();
  });

  it('takes the group logo while the title shows the group symbol', () => {
    expect(
      resolveReceiveTitleIconURI({
        isNetworkEntry: false,
        tokenLogoURI: 'token.png',
        groupLogoURI: 'group.png',
      }),
    ).toBe('group.png');
  });
});
