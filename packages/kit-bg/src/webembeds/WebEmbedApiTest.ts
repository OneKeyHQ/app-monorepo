import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

class WebEmbedApiTest {
  test1(...params: string[]) {
    return Promise.resolve(
      `${params.join('---')}: ${globalThis.location.href}`,
    );
  }

  test2() {
    return Promise.resolve(globalThis.WEB_EMBED_ONEKEY_APP_SETTINGS);
  }

  trackEvent() {
    defaultLogger.app.page.testWebEmbed();
  }

  captureException() {
    setTimeout(() => {
      throw new OneKeyLocalError('test webEmbed error');
    }, 1000);
  }
}

export default WebEmbedApiTest;
