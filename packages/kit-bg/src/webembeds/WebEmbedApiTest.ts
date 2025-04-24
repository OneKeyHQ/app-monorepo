import { analytics } from '@onekeyhq/shared/src/analytics';

class WebEmbedApiTest {
  test1(...params: string[]) {
    return Promise.resolve(
      `${params.join('---')}: ${globalThis.location.href}`,
    );
  }

  trackEvent() {
    analytics.trackEvent('test_web_embed_event', {
      test: 'test',
    });
  }
}

export default WebEmbedApiTest;
