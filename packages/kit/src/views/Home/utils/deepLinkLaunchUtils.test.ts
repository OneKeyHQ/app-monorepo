import {
  isAppClipBannerMetaContent,
  isIOSSafariUserAgent,
} from './deepLinkLaunchUtils';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';

describe('isIOSSafariUserAgent', () => {
  it('accepts Safari on iPhone and iPadOS desktop mode', () => {
    expect(isIOSSafariUserAgent(IPHONE_SAFARI)).toBe(true);
    expect(isIOSSafariUserAgent(IPAD_DESKTOP_SAFARI)).toBe(true);
  });

  it('rejects other iOS browsers', () => {
    expect(
      isIOSSafariUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/137.0.7151.107 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false);
    expect(
      isIOSSafariUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/139.0 Mobile/15E148 Safari/605.1.15',
      ),
    ).toBe(false);
    expect(
      isIOSSafariUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/137.3296.68 Mobile/15E148 Safari/605.1.15',
      ),
    ).toBe(false);
  });

  it('rejects in-app web views', () => {
    expect(
      isIOSSafariUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.60(0x18003c2f) NetType/WIFI Language/zh_CN',
      ),
    ).toBe(false);
    expect(
      isIOSSafariUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      ),
    ).toBe(false);
  });

  it('rejects Android and desktop Chrome', () => {
    expect(
      isIOSSafariUserAgent(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe(false);
    expect(
      isIOSSafariUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      ),
    ).toBe(false);
  });
});

describe('isAppClipBannerMetaContent', () => {
  it('accepts only banner metas that offer the App Clip card', () => {
    expect(
      isAppClipBannerMetaContent(
        'app-id=1609559473, app-clip-bundle-id=so.onekey.wallet.Clip, app-clip-display=card',
      ),
    ).toBe(true);
    expect(isAppClipBannerMetaContent('app-id=1609559473')).toBe(false);
    expect(isAppClipBannerMetaContent('')).toBe(false);
    expect(isAppClipBannerMetaContent(null)).toBe(false);
  });
});
