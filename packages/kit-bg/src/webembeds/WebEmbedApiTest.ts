import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

class WebEmbedApiTest {
  test1(...params: string[]) {
    return Promise.resolve(
      `${params.join('---')}: ${globalThis.location.href}`,
    );
  }

  trackEvent() {
    defaultLogger.app.page.testWebEmbed();
  }
}

export default WebEmbedApiTest;
