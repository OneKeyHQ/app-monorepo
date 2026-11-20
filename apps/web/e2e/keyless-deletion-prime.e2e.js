// cspell:ignore apikey lockdown
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
const enUS = require('../../../packages/shared/src/locale/json/en_US.json');
const jaJP = require('../../../packages/shared/src/locale/json/ja_JP.json');
const zhCN = require('../../../packages/shared/src/locale/json/zh_CN.json');

const zh = (key, values = {}) =>
  Object.entries(values).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, value),
    zhCN[key],
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
        recoveryProofs = [],
        prepare,
        alternateInvitation,
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
      let currentProof = oauthProof;
      let currentInvitation = token;
      const cors = {
        'access-control-allow-origin': appOrigin,
        'access-control-allow-headers':
          'content-type,idempotency-key,apikey,authorization,x-client-info,x-supabase-api-version,x-onekey-keyless-result',
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
          if (loopback) {
            if (alternateInvitation && url.pathname.includes('mountAppRoute')) {
              currentInvitation = alternateInvitation;
              await page.evaluate((invitation) => {
                location.hash = `invitationToken=${encodeURIComponent(invitation)}`;
              }, currentInvitation);
            }
            return route.continue();
          }
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
          const previousExchanges = calls.filter(
            ({ endpoint }) => endpoint === 'oauth-exchange',
          ).length;
          currentProof = recoveryProofs[previousExchanges - 1] ?? oauthProof;
          calls.push({ endpoint: 'oauth-exchange' });
          return route.fulfill({
            headers: cors,
            json: {
              access_token: currentProof,
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
            const hardening = await page.evaluate(
              () => globalThis.__ONEKEY_SES_HARDEN_STATE__,
            );
            assert.equal(hardening?.runtime, 'web');
            assert.equal(hardening.lockdownApplied, true);
            assert.equal(hardening.objectPrototypeFrozen, true);
            assert.deepEqual(body, { invitationToken: currentInvitation });
          } else if (endpoint === '/delete') {
            assert.ok(key);
            assert.deepEqual(body, {
              invitationToken: currentInvitation,
              provider,
              supabaseAccessToken: currentProof,
              challengeId: 'fixture-challenge',
              code: '01234567',
              confirmationVersion: currentVersion,
              acknowledgements: warnings,
            });
          } else {
            assert.deepEqual(body, {
              invitationToken: currentInvitation,
              provider,
              supabaseAccessToken: currentProof,
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
              data = receipt;
              break;
            case '/result':
              data =
                headers['x-onekey-keyless-result'] === 'current-share-status'
                  ? { ...receipt, currentShareStatus: 'absent' }
                  : receipt;
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
        await prepare?.(page);
        const invitationUrl = `${appOrigin}/keyless-deletion#invitationToken=${encodeURIComponent(token)}`;
        await page.goto(invitationUrl);
        await id('app-keyless-deletion').waitFor();
        const expectedUrl = `${appOrigin}/keyless-deletion#invitationToken=${encodeURIComponent(alternateInvitation ?? token)}`;
        assert.equal(page.url(), expectedUrl);
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
          ...recoveryProofs,
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
    for (const mode of ['reject', 'hang']) {
      await scenario(
        `invitation loading continues when wallet IndexedDB reads ${mode}`,
        {
          appOrigin: local,
          linkOnly: true,
          prepare: (page) =>
            page.addInitScript((behavior) => {
              const open = IDBFactory.prototype.open;
              IDBFactory.prototype.open = function openDatabase(name, ...args) {
                if (name !== 'OneKeyGlobalStates')
                  return open.call(this, name, ...args);
                if (behavior === 'reject')
                  throw new DOMException('Unavailable', 'SecurityError');
                return new EventTarget();
              };
            }, mode),
        },
        async ({ step, calls }) => {
          await step('identity');
          assert.deepEqual(calls(), ['/link-info']);
        },
      );
    }
    await scenario(
      'changing the invitation before the route loads reads only the new fragment',
      {
        appOrigin: local,
        linkOnly: true,
        alternateInvitation: 'fixture-new-invitation',
      },
      async ({ step, calls }) => {
        await step('identity');
        assert.deepEqual(calls(), ['/link-info']);
      },
    );
    await scenario(
      'ready Google submits the official request once and displays completion',
      {},
      async ({ page, id, verify, deleteKeys }) => {
        await verify();
        await page
          .getByRole('heading', { name: zh('keyless_deletion_confirm__title') })
          .waitFor();
        assert.equal(
          await id('otp-delivery-status').textContent(),
          zh('keyless_deletion_code_sent__desc', {
            email: 'd***@example.invalid',
            minutes: 10,
          }),
        );
        // Code entry comes first; warnings sit right above the consent checkboxes.
        const order = await page.evaluate(() =>
          [
            '#deletion-code-input',
            '[data-testid="send-code"]',
            '#deletion-warnings',
            '[data-testid="acknowledge"]',
            '[data-testid="acknowledge-new-wallet"]',
            '[data-testid="submit-deletion"]',
          ].map(
            (selector) =>
              document.querySelector(selector)?.getBoundingClientRect().top,
          ),
        );
        assert.ok(
          order.every(
            (top, index) =>
              Number.isFinite(top) && (index === 0 || top > order[index - 1]),
          ),
          `unexpected confirm order ${order.join(',')}`,
        );
        await id('submit-deletion').evaluate((button) => {
          button.click();
          button.click();
        });
        await page
          .getByRole('heading', {
            name: zh('keyless_deletion_complete__title'),
          })
          .waitFor();
        assert.equal(deleteKeys().length, 1);
        assert.equal(await id('support-reference').textContent(), reference);
        assert.ok(await id('copy-support-reference').isVisible());
        assert.ok(await id('keep-wallet-hint').isVisible());
        assert.equal(
          await id('support-contact').locator('a').getAttribute('href'),
          'mailto:legal@onekey.so',
        );
      },
    );
    await scenario(
      'loopback Apple uses the shared OAuth project and only queries test Prime',
      { appOrigin: local, provider: 'apple', status: 'used' },
      async ({ page, id, calls }) => {
        await page
          .getByRole('heading', {
            name: zh('keyless_deletion_complete__title'),
          })
          .waitFor();
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
      async ({ page, id, step, calls }) => {
        await step('identity');
        assert.ok(await id('sign-in-google').isVisible());
        await page
          .getByRole('heading', { name: zh('keyless_deletion__title') })
          .waitFor();
        await id('sign-in-scope')
          .getByText(zh('keyless_deletion_will_delete__desc'))
          .waitFor();
        await id('sign-in-scope')
          .getByText(zh('keyless_deletion_not_affected__desc'))
          .waitFor();
        await id('sign-in-intro')
          .getByText(
            zh('keyless_deletion_sign_in__desc', { platform: 'Google' }),
          )
          .waitFor();
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
        await dialog.getByRole('button', { name: zh('global.got_it') }).click();
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
          .getByText(zh('keyless_deletion_code_uncertain__msg'))
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
      'a rate-limited resend leaves the active OTP and confirmation usable',
      {
        reply: (endpoint, calls) => {
          if (endpoint !== '/otp/send') return undefined;
          if (calls.filter((call) => call.endpoint === endpoint).length === 1) {
            return {
              json: success({
                challengeId: 'fixture-challenge',
                maskedEmail: 'd***@example.invalid',
                expiresAt: '2030-01-01T00:10:00Z',
                resendAfterSeconds: 0,
                serverTime: time,
              }),
            };
          }
          return {
            json: { code: 90_906, message: '稍后重发。', retryAfterSec: 60 },
          };
        },
      },
      async ({ page, id, verify, calls }) => {
        await verify();
        await id('send-code').click();
        await id('flow-error').getByText('稍后重发。').waitFor();
        assert.ok(await id('send-code').isDisabled());
        assert.equal(await id('deletion-code').inputValue(), '01234567');
        assert.ok(await id('acknowledge').isChecked());
        assert.ok(await id('acknowledge-new-wallet').isChecked());
        assert.ok(await id('submit-deletion').isEnabled());
        await id('submit-deletion').click();
        await page
          .getByRole('heading', {
            name: zh('keyless_deletion_complete__title'),
          })
          .waitFor();
        assert.deepEqual(calls().slice(-4), [
          '/otp/send',
          '/otp/send',
          '/delete',
          '/result',
        ]);
      },
    );
    await scenario(
      'a server-expired OTP stays blocked when the resend is rate-limited',
      {
        reply: (endpoint, calls) => {
          if (endpoint === '/delete') {
            return { json: { code: 90_905, message: '验证码已过期。' } };
          }
          if (endpoint !== '/otp/send') return undefined;
          const sends = calls.filter(
            (call) => call.endpoint === endpoint,
          ).length;
          if (sends === 2) {
            return {
              json: { code: 90_906, message: '稍后重发。', retryAfterSec: 2 },
            };
          }
          return {
            json: success({
              challengeId:
                sends === 1 ? 'fixture-challenge' : 'fixture-new-challenge',
              maskedEmail: 'd***@example.invalid',
              expiresAt: '2030-01-01T00:10:00Z',
              resendAfterSeconds: 0,
              serverTime: time,
            }),
          };
        },
      },
      async ({ page, id, verify, calls }) => {
        await verify();
        await id('submit-deletion').click();
        await page.getByText('验证码已过期。', { exact: true }).waitFor();
        assert.ok(await id('submit-deletion').isDisabled());
        await id('send-code').click();
        await id('flow-error').getByText('稍后重发。').waitFor();
        assert.ok(await id('submit-deletion').isDisabled());
        assert.ok(await id('deletion-code').isDisabled());
        await id('send-code').click({ timeout: 5000 });
        await verify();
        assert.equal(
          calls().filter((endpoint) => endpoint === '/delete').length,
          1,
        );
      },
    );
    await scenario(
      'resending an OTP does not clear the deletion rate limit',
      {
        reply: (endpoint, calls) => {
          if (endpoint === '/delete') {
            return {
              json: { code: 90_906, message: '稍后删除。', retryAfterSec: 60 },
            };
          }
          if (endpoint === '/otp/send') {
            const first =
              calls.filter((call) => call.endpoint === endpoint).length === 1;
            return {
              json: success({
                challengeId: first
                  ? 'fixture-challenge'
                  : 'fixture-new-challenge',
                maskedEmail: 'd***@example.invalid',
                expiresAt: '2030-01-01T00:10:00Z',
                resendAfterSeconds: first ? 0 : 30,
                serverTime: time,
              }),
            };
          }
          return undefined;
        },
      },
      async ({ id, verify, calls }) => {
        await verify();
        await id('submit-deletion').click();
        await id('flow-error').getByText('稍后删除。').waitFor();
        assert.ok(await id('submit-deletion').isDisabled());
        await id('send-code').click();
        await id('flow-error').waitFor({ state: 'hidden' });
        assert.ok(await id('send-code').isDisabled());
        assert.equal(await id('deletion-code').inputValue(), '');
        await id('deletion-code').fill('01234567');
        await id('acknowledge').check();
        await id('acknowledge-new-wallet').check();
        assert.ok(await id('submit-deletion').isDisabled());
        assert.deepEqual(calls().slice(-3), [
          '/otp/send',
          '/delete',
          '/otp/send',
        ]);
      },
    );
    await scenario(
      'a confirmation change keeps the form and shows the server message',
      {
        reply: (endpoint) =>
          endpoint === '/delete'
            ? { json: { code: 90_908, message: '确认版本已更新。' } }
            : undefined,
      },
      async ({ id, step, verify, calls }) => {
        await verify();
        await id('submit-deletion').click();
        await id('flow-error').getByText('确认版本已更新。').waitFor();
        await step('confirm');
        assert.equal(calls().at(-1), '/delete');
        assert.equal(
          calls().filter((endpoint) => endpoint === '/result').length,
          0,
        );
      },
    );
    await scenario(
      'an expired sign-in during deletion returns to sign-in without a second delete',
      {
        reply: (endpoint) =>
          endpoint === '/delete'
            ? { json: { code: 90_902, message: '登录已过期。' } }
            : undefined,
      },
      async ({ page, id, step, verify, calls }) => {
        await verify();
        await id('submit-deletion').click();
        const dialog = page.getByRole('dialog');
        await dialog.getByText('登录已过期。').waitFor();
        await dialog.getByRole('button', { name: zh('global.got_it') }).click();
        await step('identity');
        assert.ok(await id('sign-in-google').isEnabled());
        assert.equal(
          calls().filter((endpoint) => endpoint === '/delete').length,
          1,
        );
      },
    );
    await scenario(
      'a deletion Retry-After blocks resubmission and reuses the original key',
      {
        reply: (endpoint, calls) =>
          endpoint === '/delete' &&
          calls.filter((call) => call.endpoint === endpoint).length === 1
            ? {
                status: 503,
                headers: { 'Retry-After': '3' },
                json: { code: 90_914, message: '稍后重试删除。' },
              }
            : undefined,
      },
      async ({ page, id, step, verify, calls, deleteKeys }) => {
        await verify();
        await id('submit-deletion').click();
        await id('flow-error').getByText('稍后重试删除。').waitFor();
        await step('confirm');
        assert.ok(await id('submit-deletion').isDisabled());
        await id('submit-deletion').click({ timeout: 6000 });
        await page
          .getByRole('heading', {
            name: zh('keyless_deletion_complete__title'),
          })
          .waitFor();
        assert.equal(deleteKeys().length, 2);
        assert.equal(...deleteKeys());
        assert.deepEqual(calls().slice(-3), ['/delete', '/delete', '/result']);
      },
    );
    for (const expired of [false, true]) {
      await scenario(
        `an unavailable invitation ends without exposing past results (${expired ? 'expired' : 'used'} invitation)`,
        {
          status: 'used',
          linkOnly: expired,
          reply: (endpoint) => {
            if (expired && endpoint === '/link-info') {
              return { json: { code: 90_900, message: '邀请已过期。' } };
            }
            if (endpoint === '/result') {
              return {
                json: {
                  code: 90_900,
                  message: '<b>UNSAFE_RECOVERY_MESSAGE</b>',
                },
              };
            }
            return undefined;
          },
        },
        async ({ page, id, calls }) => {
          await page
            .getByRole('heading', {
              name: zh('keyless_deletion_link_unavailable__title'),
            })
            .waitFor();
          await page
            .getByText(zh('keyless_deletion_link_unavailable__desc'))
            .waitFor();
          assert.equal(
            await page.getByText(/UNSAFE_RECOVERY_MESSAGE/).count(),
            0,
          );
          assert.ok(await id('support-contact').isVisible());
          assert.equal(await id('reauthenticate').count(), 0);
          assert.deepEqual(
            calls().filter((call) => call.startsWith('/')),
            expired ? ['/link-info'] : ['/link-info', '/result'],
          );
        },
      );
    }
    await scenario(
      'a lost delete response keeps the form and retries with the same key',
      {
        reply: (endpoint, calls) =>
          endpoint === '/delete' &&
          calls.filter((call) => call.endpoint === endpoint).length === 1
            ? 'disconnect'
            : undefined,
      },
      async ({ page, id, step, verify, deleteKeys }) => {
        await verify();
        await id('submit-deletion').click();
        await page.getByTestId('onekey-toast-messages').waitFor();
        await step('confirm');
        await id('submit-deletion').click();
        await page
          .getByRole('heading', {
            name: zh('keyless_deletion_complete__title'),
          })
          .waitFor();
        assert.equal(deleteKeys().length, 2);
        assert.equal(...deleteKeys());
      },
    );
    await scenario(
      'a failed result check keeps the known processing state',
      {
        reply: (endpoint, calls) => {
          if (endpoint === '/delete') {
            return {
              json: {
                code: 90_912,
                message: '删除申请正在处理中。',
                data: { supportReference: reference },
              },
            };
          }
          if (endpoint !== '/result') return undefined;
          const reads = calls.filter(
            (call) => call.endpoint === endpoint,
          ).length;
          if (reads === 1)
            return {
              json: success({
                status: 'processing',
                resultId: receipt.resultId,
                supportReference: reference,
                retryAfterSeconds: 0,
              }),
            };
          if (reads === 2) return 'disconnect';
          return undefined;
        },
      },
      async ({ page, id, verify, calls, deleteKeys }) => {
        await verify();
        await id('submit-deletion').click();
        const processing = page.getByRole('heading', { name: '处理中' });
        await processing.waitFor();
        await id('check-status').click();
        await page
          .getByText(zh('keyless_deletion_status_unknown__desc'))
          .waitFor();
        assert.ok(await processing.isVisible());
        assert.equal(await id('support-reference').textContent(), reference);
        await id('check-status').click();
        await page
          .getByRole('heading', {
            name: zh('keyless_deletion_complete__title'),
          })
          .waitFor();
        assert.equal(deleteKeys().length, 1);
        assert.deepEqual(calls().slice(-4), [
          '/delete',
          '/result',
          '/result',
          '/result',
        ]);
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
        await page
          .getByRole('heading', {
            name: zh('keyless_deletion_manual_review__title'),
          })
          .waitFor();
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
        prepare: (page) =>
          page.addInitScript(() => {
            const put = IDBObjectStore.prototype.put;
            globalThis.walletSettingsWrites = 0;
            IDBObjectStore.prototype.put = function putEntry(value, key) {
              if (key === 'g_states_v5:settingsPersistAtom')
                globalThis.walletSettingsWrites += 1;
              return put.call(this, value, key);
            };
          }),
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
        const search = id('nav-header-search-select-search');
        const expectedLanguages = LOCALES_OPTION.map(
          ({ value }) => value,
        ).filter((value) => value !== 'en-US');
        await id('select-item-system').waitFor();
        for (const locale of expectedLanguages) {
          await search.fill(locale);
          await id(`select-item-${locale}`).waitFor();
        }
        assert.equal(await id('select-item-en-US').count(), 0);
        console.log(
          `PASS App language menu contains all ${expectedLanguages.length} languages and Auto`,
        );
        await search.fill('ja-JP');
        await id('select-item-ja-JP').click();
        await page.getByPlaceholder('認証コードを入力してください').waitFor();
        assert.equal(
          await id('otp-delivery-status').textContent(),
          jaJP.keyless_deletion_code_sent__desc
            .replace('{email}', 'd***@example.invalid')
            .replace('{minutes}', '10'),
        );
        assert.match(await id('send-code').textContent(), /再送/);
        await page
          .getByText(jaJP.keyless_deletion_scope__title, { exact: true })
          .waitFor();
        await page
          .getByRole('button', { name: jaJP.keyless_deletion_delete__action })
          .waitFor();
        assert.equal(await id('deletion-code').inputValue(), '01234567');
        assert.ok(await id('acknowledge').isChecked());
        assert.ok(await id('acknowledge-new-wallet').isChecked());
        assert.ok(await id('submit-deletion').isEnabled());
        assert.equal(await assertFits(), true);
        assert.equal(page.url(), initialUrl);
        assert.deepEqual(calls(), beforeSwitch);
        assert.equal(await page.locator('html').getAttribute('lang'), 'ja-JP');
        assert.equal(
          await page.evaluate(() => globalThis.walletSettingsWrites),
          0,
        );
        await id('submit-deletion').click();
        await page
          .getByRole('heading', { name: jaJP.keyless_deletion_complete__title })
          .waitFor();
        await id('keyless-language-button').click();
        await id('select-item-en').click();
        await page.waitForFunction(
          () => document.documentElement.lang === 'en',
        );
        await page
          .getByRole('heading', { name: enUS.keyless_deletion_complete__title })
          .waitFor();
        assert.equal(page.url(), initialUrl);
        assert.deepEqual(calls(), [
          '/link-info',
          '/link-info',
          'oauth-authorize',
          'oauth-exchange',
          '/otp/send',
          '/delete',
          '/result',
        ]);
        for (const hash of [
          '#token=obsolete-alias',
          '#invitationToken=opaque&env=test',
          '',
        ]) {
          await page.goto(`${local}/keyless-deletion${hash}`);
          await id('app-open-invitation').waitFor();
        }
        assert.deepEqual(calls(), [...beforeSwitch, '/delete', '/result']);
        assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
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
    await scenario(
      'a blocked OAuth popup explains how to continue and offers the page link',
      {
        appOrigin: local,
        linkOnly: true,
        prepare: (page) =>
          page.addInitScript(() => {
            globalThis.open = () => null;
          }),
      },
      async ({ page, id, step, calls }) => {
        await step('identity');
        await id('sign-in-google').click();
        const error = id('flow-error');
        await error
          .getByText(zh('keyless_deletion_popup_blocked__msg'))
          .waitFor();
        assert.equal(
          await error.getAttribute('data-error-code'),
          'POPUP_BLOCKED',
        );
        assert.equal(
          await page.getByTestId('onekey-toast-messages').count(),
          0,
        );
        await page
          .context()
          .grantPermissions(['clipboard-read', 'clipboard-write'], {
            origin: local,
          });
        await id('copy-page-link').click();
        await page.waitForFunction(
          async () => (await navigator.clipboard.readText()) === location.href,
        );
        assert.equal(await id('page-link-fallback').count(), 0);
        await page.evaluate(() => {
          navigator.clipboard.writeText = () =>
            Promise.reject(new DOMException('Denied', 'NotAllowedError'));
        });
        await id('copy-page-link').click();
        await id('page-link-fallback').waitFor();
        assert.equal(
          await id('page-link-fallback').textContent(),
          await page.evaluate(() => location.href),
        );
        assert.ok(await id('sign-in-google').isEnabled());
        assert.deepEqual(calls(), ['/link-info']);
      },
    );
    await scenario(
      'a blocked popup during result sign-in is explained on the result screen',
      {
        status: 'used',
        reply: (endpoint) =>
          endpoint === '/result'
            ? { json: { code: 90_902, message: '登录已过期。' } }
            : undefined,
      },
      async ({ page, id, calls }) => {
        const dialog = page.getByRole('dialog');
        await dialog.getByText('登录已过期。').waitFor();
        await dialog.getByRole('button', { name: zh('global.got_it') }).click();
        await page.evaluate(() => {
          globalThis.open = () => null;
        });
        await id('reauthenticate').click();
        const error = id('flow-error');
        await error
          .getByText(zh('keyless_deletion_popup_blocked__msg'))
          .waitFor();
        assert.equal(
          await error.getAttribute('data-error-code'),
          'POPUP_BLOCKED',
        );
        assert.ok(await id('copy-page-link').isVisible());
        assert.equal(
          calls().filter((endpoint) => endpoint === '/delete').length,
          0,
        );
      },
    );
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
        await page
          .getByRole('heading', {
            name: zh('keyless_deletion_link_load_failed__title'),
          })
          .waitFor();
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
        await page
          .getByRole('heading', {
            name: zh('keyless_deletion_link_unavailable__title'),
          })
          .waitFor();
        await page
          .getByText(zh('keyless_deletion_link_unavailable__desc'))
          .waitFor();
        assert.equal(await id('sign-in-google').count(), 0);
        assert.equal(
          await id('support-contact').locator('a').getAttribute('href'),
          'mailto:legal@onekey.so',
        );
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
        await page
          .getByRole('heading', {
            name: zh('keyless_deletion_link_load_failed__title'),
          })
          .waitFor();
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
        const toast = page
          .getByTestId('onekey-toast-messages')
          .getByText('服务暂时不可用，请稍后重试。', { exact: true });
        await toast.waitFor();
        assert.equal(await toast.count(), 1);
        await page
          .getByRole('heading', {
            name: zh('keyless_deletion_link_load_failed__title'),
          })
          .waitFor();
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
