import { getSafeMarkdownHref, getSafeMarkdownImageUri } from './urlUtils';

describe('Markdown URL handling', () => {
  it('allows supported link protocols and normalizes host-only URLs', () => {
    expect(getSafeMarkdownHref('https://onekey.so')).toBe('https://onekey.so');
    expect(getSafeMarkdownHref('http://onekey.so')).toBe('http://onekey.so');
    expect(getSafeMarkdownHref('mailto:support@onekey.so')).toBe(
      'mailto:support@onekey.so',
    );
    expect(getSafeMarkdownHref('onekey.so/help')).toBe(
      'https://onekey.so/help',
    );
  });

  it('rejects executable, data, and custom link protocols', () => {
    const scriptUrl = ['java', 'script:alert(1)'].join('');

    expect(getSafeMarkdownHref(scriptUrl)).toBeUndefined();
    expect(
      getSafeMarkdownHref('data:text/html;base64,PHNjcmlwdD4='),
    ).toBeUndefined();
    expect(getSafeMarkdownHref('onekey-wallet://account/list')).toBeUndefined();
  });

  it('allows HTTPS and safe raster data images only', () => {
    expect(getSafeMarkdownImageUri('assets.onekey.so/logo.png')).toBe(
      'https://assets.onekey.so/logo.png',
    );
    expect(getSafeMarkdownImageUri('https://assets.onekey.so/logo.png')).toBe(
      'https://assets.onekey.so/logo.png',
    );
    expect(getSafeMarkdownImageUri('data:image/png;base64,aGVsbG8=')).toBe(
      'data:image/png;base64,aGVsbG8=',
    );
    expect(
      getSafeMarkdownImageUri('data:image/svg+xml,<svg onload="alert(1)"/>'),
    ).toBeUndefined();
    expect(
      getSafeMarkdownImageUri('http://assets.onekey.so/logo.png'),
    ).toBeUndefined();
  });
});
