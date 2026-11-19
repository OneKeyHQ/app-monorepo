// cspell:ignore apikey
const assert = require('node:assert/strict');

const createJiti = require('jiti');
const { chromium } = require('playwright-core');

const load = createJiti(__filename);
const { KEYLESS_SUPABASE_PUBLIC_API_KEY } = load(
  '../../../packages/shared/src/consts/authConsts',
);

const { LOCALES_OPTION } = load(
  '../../../packages/shared/src/locale/localeOptions',
);
const local = `http://127.0.0.1:${Number(process.env.KEYLESS_APP_WEB_E2E_PORT ?? '3003')}`;
const app = 'https://app.onekeytest.com';
const productionApp = 'https://app.onekey.so';
const prime = 'https://prime.onekeytest.com';
const auth = 'https://auth.onekey.so';
const base = '/prime/v1/keyless-deletion';
const token = 'fixture+prime/invitation==';
const oauthProof = 'fixture-prime-supabase-access';
const time = '2030-01-01T00:00:00Z';
const warnings = ['recovery_lost', 'new_wallet_separate'];
const retainedScope = ['juicebox_share', 'cloud_sync', 'onekey_id'];
const deletedScope = ['onekey_server_share'];
const version = 'keyless-server-share-deletion/v1';
const reference = 'OKD-FIXTURE';
const receipt = {
  status: 'completed',
  resultId: 'fixture-result',
  supportReference: reference,
  completedAt: time,
  deletedScope,
  retainedScope,
};
const success = (data) => ({ code: 0, message: 'success', data });

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const scenario = async (
      title,
      {
        provider = 'google',
        status = 'ready',
        reply,
        appOrigin = app,
        badState = false,
        refreshTest = false,
        linkOnly = false,
        viewport,
      },
      run,
    ) => {
      const context = await browser.newContext({
        serviceWorkers: 'block',
        locale: 'zh-CN',
        viewport,
      });
      let closing = false;
      const loopback = appOrigin === local;
      const targetPrime =
        appOrigin === productionApp ? 'https://prime.onekeycn.com' : prime;
      const calls = [];
      const errors = [];
      const unexpected = [];
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      let currentVersion = version;
      const cors = {
        'access-control-allow-origin': appOrigin,
        'access-control-allow-headers':
          'content-type,idempotency-key,apikey,authorization,x-client-info,x-supabase-api-version',
        'access-control-allow-methods': 'POST,OPTIONS',
        'access-control-expose-headers': 'Retry-After',
      };
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === appOrigin) {
          if (request.method() !== 'GET') {
            unexpected.push('Unexpected App request');
            return route.abort();
          }
          if (loopback) return route.continue();
          // Serve the worktree bundle in an isolated Chrome context.
          try {
            const served = await route.fetch({
              url: local + url.pathname,
              maxRedirects: 0,
            });
            return await route.fulfill({ response: served });
          } catch (error) {
            if (!closing) throw error;
            return undefined;
          }
        }
        if (
          request.method() === 'OPTIONS' &&
          [targetPrime, auth].includes(url.origin)
        ) {
          return route.fulfill({ status: 204, headers: cors });
        }
        if (url.origin === auth && url.pathname === '/auth/v1/authorize') {
          assert.equal(url.searchParams.get('provider'), provider);
          assert.equal(url.searchParams.get('code_challenge_method'), 's256');
          const callback = new URL(url.searchParams.get('redirect_to'));
          assert.equal(callback.origin, appOrigin);
          assert.equal(callback.pathname, '/oauth_callback_web/');
          assert.equal(
            callback.searchParams.get('onekey_keyless_deletion'),
            '1',
          );
          assert.ok(callback.searchParams.has('onekey_oauth_state'));
          assert.ok(!callback.href.includes(encodeURIComponent(token)));
          calls.push({ endpoint: 'oauth-authorize' });
          callback.searchParams.set('code', 'fixture-pkce-code');
          if (badState)
            callback.searchParams.set('onekey_oauth_state', 'wrong-state');
          // A new navigation keeps the callback behind the browser's route interception.
          return route.fulfill({
            contentType: 'text/html',
            body: `<script>location.replace(${JSON.stringify(callback.href)})</script>`,
          });
        }
        if (url.origin === auth && url.pathname === '/auth/v1/token') {
          assert.equal(url.search, '?grant_type=pkce');
          assert.ok(
            request.headers().apikey === KEYLESS_SUPABASE_PUBLIC_API_KEY,
            'PKCE exchange uses the default Keyless project public key',
          );
          assert.equal(request.postDataJSON().auth_code, 'fixture-pkce-code');
          assert.ok(request.postDataJSON().code_verifier);
          calls.push({ endpoint: 'oauth-exchange' });
          return route.fulfill({
            headers: cors,
            json: {
              access_token: oauthProof,
              refresh_token: 'fixture-refresh-proof',
              token_type: 'bearer',
              expires_in: 3600,
              user: {
                id: 'fixture-oauth-user',
                app_metadata: {},
                user_metadata: {},
              },
            },
          });
        }
        if (url.origin === targetPrime && url.pathname.startsWith(base)) {
          assert.equal(request.method(), 'POST');
          assert.equal(url.search, '');
          assert.equal(url.hash, '');
          const endpoint = url.pathname.slice(base.length);
          const body = request.postDataJSON();
          const headers = request.headers();
          const key = headers['idempotency-key'];
          assert.equal(headers.origin, appOrigin);
          assert.equal(headers.cookie, undefined);
          assert.equal(headers.authorization, undefined);
          if (endpoint === '/link-info') {
            assert.deepEqual(body, { invitationToken: token });
          } else if (endpoint === '/delete') {
            assert.ok(key);
            assert.deepEqual(body, {
              invitationToken: token,
              provider,
              supabaseAccessToken: oauthProof,
              challengeId: 'fixture-challenge',
              code: '01234567',
              confirmationVersion: currentVersion,
              acknowledgements: warnings,
            });
          } else {
            assert.deepEqual(body, {
              invitationToken: token,
              provider,
              supabaseAccessToken: oauthProof,
            });
          }
          if (endpoint !== '/delete') assert.equal(key, undefined);
          calls.push({ endpoint, key });
          const custom = await reply?.(endpoint, calls, (next) => {
            currentVersion = next;
          });
          if (custom === 'disconnect') return route.abort('failed');
          if (custom) {
            return route.fulfill({
              ...custom,
              headers: { ...cors, ...custom.headers },
            });
          }
          let data;
          switch (endpoint) {
            case '/link-info':
              data = {
                status,
                allowedProvider: provider,
                expiresAt: '2030-01-01T01:00:00Z',
                serverTime: time,
                confirmationVersion: currentVersion,
                deletionScope: deletedScope,
                retainedScope,
                warningCodes: warnings,
                recreationPolicy: 'allowed_new_wallet',
              };
              break;
            case '/otp/send':
              data = {
                challengeId: 'fixture-challenge',
                maskedEmail: 'd***@example.invalid',
                expiresAt: '2030-01-01T00:10:00Z',
                resendAfterSeconds: 60,
                serverTime: time,
              };
              break;
            case '/delete':
            case '/result':
              data = receipt;
              break;
            default:
              throw new TypeError('Unexpected Prime route.');
          }
          return route.fulfill({ headers: cors, json: success(data) });
        }
        unexpected.push(url.origin);
        return route.abort();
      });
      const id = (name) => page.getByTestId(name);
      const step = (name) =>
        page
          .locator(`[data-testid="flow"][data-step="${name}"]`)
          .waitFor({ timeout: 10_000 });
      const verify = async () => {
        await step('confirm');
        await page.waitForFunction(
          () => document.activeElement?.id === 'deletion-code-input',
        );
        await id('deletion-code').fill('01234567');
        assert.ok(await id('submit-deletion').isDisabled());
        await id('acknowledge').check();
        assert.ok(await id('submit-deletion').isDisabled());
        await id('acknowledge-new-wallet').check();
        assert.ok(await id('submit-deletion').isEnabled());
      };
      try {
        const invitationUrl = `${appOrigin}/keyless-deletion#invitationToken=${encodeURIComponent(token)}`;
        await page.goto(invitationUrl);
        await id('app-keyless-deletion').waitFor();
        assert.equal(page.url(), invitationUrl);
        assert.equal(await id('app-environment-picker').count(), 0);
        assert.equal(await id('keyless-language-button').count(), 1);
        if (!linkOnly) {
          await step('identity');
          if (refreshTest) {
            await page.reload();
            await step('identity');
            assert.equal(page.url(), invitationUrl);
            assert.deepEqual(
              calls.map((call) => call.endpoint),
              ['/link-info', '/link-info'],
            );
          }
          assert.equal(
            await id(
              `sign-in-${provider === 'google' ? 'apple' : 'google'}`,
            ).count(),
            0,
          );
          const rejectedPopup = badState
            ? page
                .waitForEvent('popup')
                .then((popup) => popup.waitForEvent('close'))
            : undefined;
          await id(`sign-in-${provider}`).click();
          await rejectedPopup;
        }
        await run({
          page,
          id,
          step,
          verify,
          calls: () => calls.map((call) => call.endpoint),
          deleteKeys: () =>
            calls
              .filter((call) => call.endpoint === '/delete')
              .map((call) => call.key),
        });
        const stored = await page.evaluate(() =>
          JSON.stringify([
            Object.entries(localStorage),
            Object.entries(sessionStorage),
          ]),
        );
        for (const secret of [
          token,
          oauthProof,
          'fixture-refresh-proof',
          '01234567',
        ]) {
          assert.ok(!stored.includes(secret));
        }
        assert.deepEqual(unexpected, []);
        assert.deepEqual(errors, []);
        console.log(`PASS ${title}`);
      } finally {
        closing = true;
        await context.close();
      }
    };
    const invitationResponse = Promise.withResolvers();
    await scenario(
      'pending link-info shows the shared spinner and has no visible loading copy',
      {
        appOrigin: local,
        linkOnly: true,
        reply: () => invitationResponse.promise,
      },
      async ({ page, id, step, calls }) => {
        const loading = id('invitation-loading');
        try {
          await loading.locator('svg').waitFor();
          assert.equal(await loading.textContent(), '');
          assert.equal(await page.locator('main h1').count(), 0);
          assert.equal(await loading.getAttribute('aria-label'), '加载中…');
        } finally {
          invitationResponse.resolve();
        }
        await step('identity');
        assert.equal(await loading.count(), 0);
        assert.deepEqual(calls(), ['/link-info']);
      },
    );
    await scenario(
      'ready Google submits the official request once and displays completion',
      {},
      async ({ page, id, verify, deleteKeys }) => {
        await verify();
        await id('submit-deletion').evaluate((button) => {
          button.click();
          button.click();
        });
        await page.getByRole('heading', { name: '删除完成' }).waitFor();
        assert.equal(deleteKeys().length, 1);
        assert.equal(await id('support-reference').textContent(), reference);
      },
    );
    await scenario(
      'loopback Apple uses the shared OAuth project and only queries test Prime',
      { appOrigin: local, provider: 'apple', status: 'used' },
      async ({ page, id, calls }) => {
        await page.getByRole('heading', { name: '删除完成' }).waitFor();
        assert.deepEqual(calls(), [
          '/link-info',
          'oauth-authorize',
          'oauth-exchange',
          '/result',
        ]);
        assert.equal(await id('deletion-otp-form').count(), 0);
        assert.equal(await id('submit-deletion').count(), 0);
      },
    );
    await scenario(
      'a hosted production invitation reads only from the configured production Prime',
      { appOrigin: productionApp, linkOnly: true },
      async ({ id, step, calls }) => {
        await step('identity');
        assert.ok(await id('sign-in-google').isVisible());
        assert.deepEqual(calls(), ['/link-info']);
      },
    );
    await scenario(
      'HTTP 200 identity mismatch uses the server message and returns to login',
      {
        reply: (endpoint) =>
          endpoint === '/otp/send'
            ? { json: { code: 90_903, message: '请切换到原钱包账号。' } }
            : undefined,
      },
      async ({ page, id }) => {
        const dialog = page.getByRole('dialog');
        await dialog.getByText('请切换到原钱包账号。').waitFor();
        assert.equal(await id('deletion-code').count(), 0);
        await dialog.getByRole('button', { name: '我明白了' }).click();
        assert.ok(await id('sign-in-google').isEnabled());
      },
    );
    await scenario(
      'HTTP 200 rate limit uses retryAfterSec and accepts a later resend',
      {
        reply: (endpoint, calls) =>
          endpoint === '/otp/send' &&
          calls.filter((call) => call.endpoint === '/otp/send').length === 1
            ? {
                json: {
                  code: 90_906,
                  message: '请稍后发送。',
                  retryAfterSec: 2,
                },
              }
            : undefined,
      },
      async ({ page, id, verify, calls }) => {
        await page.getByText('请稍后发送。').waitFor();
        assert.ok(await id('send-code').isDisabled());
        assert.equal(
          calls().filter((endpoint) => endpoint === '/otp/send').length,
          1,
        );
        await id('send-code').click({ timeout: 5000 });
        await verify();
      },
    );
    await scenario(
      'lost OTP response waits without reusing or sending another challenge',
      {
        reply: (endpoint) =>
          endpoint === '/otp/send' ? 'disconnect' : undefined,
      },
      async ({ page, id, calls }) => {
        await page
          .getByText('验证码发送结果待确认。请稍后重新申请验证码。')
          .waitFor();
        assert.ok(await id('send-code').isDisabled());
        assert.ok(await id('deletion-code').isDisabled());
        assert.equal(
          calls().filter((endpoint) => endpoint === '/otp/send').length,
          1,
        );
      },
    );
    await scenario(
      'HTTP 200 confirmation change queries result before using a new key',
      {
        reply: (endpoint, calls, updateVersion) => {
          const attempts = calls.filter(
            (call) => call.endpoint === '/delete',
          ).length;
          if (endpoint === '/delete' && attempts === 1)
            return { json: { code: 90_908, message: '确认版本已更新。' } };
          if (endpoint === '/result') {
            updateVersion('keyless-server-share-deletion/v2');
            return { json: success({ status: 'not_submitted' }) };
          }
          return undefined;
        },
      },
      async ({ page, id, verify, calls, deleteKeys }) => {
        await verify();
        await id('submit-deletion').click();
        await id('confirmation-updated').waitFor();
        assert.deepEqual(calls().slice(-3), [
          '/delete',
          '/result',
          '/link-info',
        ]);
        assert.equal(
          await id('acknowledge').getAttribute('aria-checked'),
          'false',
        );
        assert.equal(
          await id('acknowledge-new-wallet').getAttribute('aria-checked'),
          'false',
        );
        await id('deletion-code').fill('01234567');
        await id('acknowledge').check();
        await id('acknowledge-new-wallet').check();
        await id('submit-deletion').click();
        await page.getByRole('heading', { name: '删除完成' }).waitFor();
        assert.equal(deleteKeys().length, 2);
        assert.notEqual(...deleteKeys());
      },
    );
    await scenario(
      'lost delete response reads the original result and preserves processing after 90900',
      {
        reply: (endpoint, calls) => {
          const reads = calls.filter(
            (call) => call.endpoint === '/result',
          ).length;
          if (endpoint === '/delete') return 'disconnect';
          if (endpoint === '/result' && reads === 1)
            return {
              json: success({
                status: 'processing',
                resultId: receipt.resultId,
                supportReference: reference,
                retryAfterSeconds: 0,
              }),
            };
          if (endpoint === '/result' && reads === 2)
            return { json: { code: 90_900, message: '请向客服核实原申请。' } };
          return undefined;
        },
      },
      async ({ page, id, verify, calls, deleteKeys }) => {
        await verify();
        await id('submit-deletion').click();
        await page.getByRole('heading', { name: '处理中' }).waitFor();
        assert.deepEqual(calls().slice(-2), ['/delete', '/result']);
        await id('check-status').click();
        await page.getByText('请向客服核实原申请。').waitFor();
        assert.equal(await id('support-reference').textContent(), reference);
        assert.equal(await id('retry-original').count(), 0);
        await id('check-status').click();
        await page.getByRole('heading', { name: '删除完成' }).waitFor();
        assert.equal(deleteKeys().length, 1);
      },
    );
    await scenario(
      'HTTP 200 manual review displays the server reference and stops duplicate deletion',
      {
        reply: (endpoint) =>
          endpoint === '/delete'
            ? {
                json: {
                  code: 90_913,
                  message: '需要人工复核。',
                  data: { supportReference: reference },
                },
              }
            : undefined,
      },
      async ({ page, id, verify, calls }) => {
        await verify();
        await id('submit-deletion').click();
        await page.getByRole('heading', { name: '需要人工核查' }).waitFor();
        assert.equal(await id('support-reference').textContent(), reference);
        assert.equal(await id('retry-original').count(), 0);
        assert.equal(calls().at(-1), '/delete');
      },
    );
    await scenario(
      'narrow loopback switches App languages without changing the invitation, OTP or confirmation',
      {
        appOrigin: local,
        refreshTest: true,
        viewport: { width: 320, height: 650 },
      },
      async ({ page, id, verify, calls }) => {
        await verify();
        const initialUrl = page.url();
        const beforeSwitch = calls();
        const assertFits = () =>
          page.evaluate(() =>
            Array.from(
              document.querySelectorAll(
                '.keyless-app-route, .keyless-app-content',
              ),
            ).every(
              (element) => element.scrollWidth <= element.clientWidth + 1,
            ),
          );
        assert.equal(await assertFits(), true);
        await id('keyless-language-button').click();
        const expectedLanguages = [
          'system',
          ...LOCALES_OPTION.map(({ value }) => value).filter(
            (value) => value !== 'en-US',
          ),
        ];
        for (const locale of expectedLanguages) {
          await id(`select-item-${locale}`).waitFor({ state: 'attached' });
        }
        assert.equal(
          await page.getByTestId(/^select-item-/).count(),
          expectedLanguages.length,
        );
        console.log(
          `PASS App language menu contains all ${expectedLanguages.length - 1} languages and Auto`,
        );
        await id('select-item-ja-JP').click();
        await page.getByPlaceholder('認証コードを入力してください').waitFor();
        assert.match(
          await id('otp-delivery-status').textContent(),
          /に送信されました/,
        );
        assert.match(await id('send-code').textContent(), /再送/);
        await page
          .getByText('仅删除 OneKey 服务端恢复分片', { exact: true })
          .waitFor();
        await page.getByRole('button', { name: '确认删除' }).waitFor();
        assert.equal(await id('deletion-code').inputValue(), '01234567');
        assert.ok(await id('acknowledge').isChecked());
        assert.ok(await id('acknowledge-new-wallet').isChecked());
        assert.ok(await id('submit-deletion').isEnabled());
        assert.equal(await assertFits(), true);
        assert.equal(page.url(), initialUrl);
        assert.deepEqual(calls(), beforeSwitch);
        assert.equal(await page.locator('html').getAttribute('lang'), 'ja-JP');
        await id('submit-deletion').click();
        await page.getByRole('heading', { name: '删除完成' }).waitFor();
        await id('keyless-language-button').click();
        await id('select-item-en').click();
        await page.waitForFunction(
          () => document.documentElement.lang === 'en',
        );
        await page.getByRole('heading', { name: '删除完成' }).waitFor();
        assert.equal(page.url(), initialUrl);
        assert.deepEqual(calls(), [
          '/link-info',
          '/link-info',
          'oauth-authorize',
          'oauth-exchange',
          '/otp/send',
          '/delete',
        ]);
        for (const hash of [
          '#token=obsolete-alias',
          '#invitationToken=opaque&env=test',
          '',
        ]) {
          await page.goto(`${local}/keyless-deletion${hash}`);
          await id('app-open-invitation').waitFor();
        }
        assert.deepEqual(calls(), [...beforeSwitch, '/delete']);
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      },
    );
    await scenario(
      'loopback OAuth rejects a changed callback state before exchange or OTP',
      { appOrigin: local, badState: true },
      async ({ page, id, calls }) => {
        await page
          .getByRole('button', { name: '使用 Google 继续', exact: true })
          .waitFor();
        assert.equal(await id('deletion-otp-form').count(), 0);
        assert.deepEqual(calls(), ['/link-info', 'oauth-authorize']);
      },
    );
    const observedMessage =
      'Unable to process this request. Refresh the page and try again.';
    await scenario(
      'wire HTTP 200 / 90915 reproduces the reported text and retries the same invitation only',
      {
        appOrigin: local,
        linkOnly: true,
        reply: () => ({
          json: {
            code: 90_915,
            message: observedMessage,
            messageId: 'error__service_prime_keyless_deletion_invalid_request',
          },
        }),
      },
      async ({ page, id, calls }) => {
        await page.getByRole('heading', { name: '暂时无法打开邀请' }).waitFor();
        await id('flow-error').getByText(observedMessage).waitFor();
        assert.equal(
          await id('flow-error').getAttribute('data-error-code'),
          'INVALID_REQUEST',
        );
        assert.equal(await id('sign-in-google').count(), 0);
        await Promise.all([
          page.waitForResponse(
            (response) => response.url() === `${prime}${base}/link-info`,
          ),
          page.getByRole('button', { name: '重试' }).click(),
        ]);
        await id('flow-error').getByText(observedMessage).waitFor();
        assert.deepEqual(calls(), ['/link-info', '/link-info']);
      },
    );
    await scenario(
      'HTTP 200 / 90900 blocks login and provides a recovery entry',
      {
        appOrigin: local,
        linkOnly: true,
        reply: () => ({
          json: {
            code: 90_900,
            message: '此邀请不可用。',
            messageId:
              'error__service_prime_keyless_deletion_invitation_unavailable',
          },
        }),
      },
      async ({ page, id, calls }) => {
        await page.getByRole('heading', { name: '此邀请已失效' }).waitFor();
        assert.equal(await id('sign-in-google').count(), 0);
        assert.ok(await id('open-recovery').isVisible());
        assert.deepEqual(calls(), ['/link-info']);
      },
    );
    await scenario(
      'HTTP 200 / 90001 keeps the server message without opening an OAuth popup',
      {
        appOrigin: local,
        linkOnly: true,
        reply: () => ({
          json: {
            code: 90_001,
            message: '请检查必填参数。',
            messageId: 'error__service_prime_params_error',
          },
        }),
      },
      async ({ page, id, calls }) => {
        await page.getByRole('heading', { name: '暂时无法打开邀请' }).waitFor();
        await id('flow-error').getByText('请检查必填参数。').waitFor();
        assert.equal(await id('sign-in-google').count(), 0);
        assert.deepEqual(calls(), ['/link-info']);
      },
    );
    await scenario(
      'unmapped HTTP 200 error preserves the localized message in the shared toast',
      {
        appOrigin: local,
        linkOnly: true,
        reply: () => ({
          json: {
            code: 90_999,
            message: '请稍后重试。',
            translatedMessage: '服务暂时不可用，请稍后重试。',
          },
        }),
      },
      async ({ page, calls }) => {
        await page
          .locator('[data-sonner-toast]')
          .getByText('服务暂时不可用，请稍后重试。')
          .waitFor();
        await page.getByRole('heading', { name: '暂时无法打开邀请' }).waitFor();
        assert.deepEqual(calls(), ['/link-info']);
      },
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
