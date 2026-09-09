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

  getRuntimeSecurityState() {
    return Promise.resolve({
      hardenType: typeof globalThis.harden,
      objectFrozen: Object.isFrozen(Object.prototype),
      arrayFrozen: Object.isFrozen(Array.prototype),
      functionFrozen: Object.isFrozen(Function.prototype),
      promiseFrozen: Object.isFrozen(Promise.prototype),
    });
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
