# Email OTP + CAPTCHA test environment

## Scope

The Developer Gallery provides an isolated test against a separately configured
Supabase project and rejects the production project. The actual combined
OneKey ID login dialog also has hidden debugging controls for selecting the
server and enabling/disabling client CAPTCHA. Its default remains production
with no client CAPTCHA, matching the existing email login behavior.

Verification was extended from **Web in wallet mode** to the real iOS and
Android login dialogs. Both mobile targets completed real CAPTCHA and OTP
issuance; numeric OTP entry for these mobile runs was left to the user.

Web and desktop use a single app JS runtime. The test SDK client is created
inside the UI. On iOS, Android and extension the test uses only `main`; `bg`
does not receive its session. Sessions are in memory with persistence and
automatic refresh disabled. No native storage instance is used and no session
is deserialized into a second runtime. Each request creates its own client.

Both isolated clients explicitly use `flowType: 'pkce'`, matching the v6.5.0
production and temporary clients. The initial test implementation omitted this
option and unintentionally used the SDK's default `implicit` flow; this has
been corrected. Session isolation does not require changing the auth flow.

## Run

### Shared hosted page

The shared Turnstile page was merged in `OneKeyHQ/app-webview-pages` PR #68,
commit `501c28ca14fdc973798cc466dfffebe3caa3cc2a`. Its source is under
`apps/oauth-login-success/captcha/`; the login module build emits
`dist/success/captcha/index.html` and a content-hashed bridge script. It uses
the existing login module's release artifacts and a root `/captcha/` script
URL. No backend function or new domain is required.

The hosted HTML includes a page-scoped CSP. HTTP response policies must allow
the Turnstile SDK, child frames, and network requests. Do not add
`X-Frame-Options: DENY` or `SAMEORIGIN`, which would block the application iframe.

Register the deployment hostname with the corresponding Turnstile widget,
then set the client CAPTCHA `pageUrl` to the deployed `/captcha/index.html` URL only
after confirming it is reachable. The page contains no secret key; Supabase
performs token validation with its configured CAPTCHA secret. Turnstile's SDK
must still load from Cloudflare's official URL and must not be vendored into
the app or static deployment.

The page includes the test site's public sitekey and verifies parent origins
against its own allowlist. Loopback parents are allowed only on local/test
deployments. Web retains its origin, iframe window, and request-ID checks.
The merged page rejects opaque `null` origins. Packaged desktop uses a separate
Electron guest and the host bridge described below. Production CAPTCHA remains disabled.

Chromium extension IDs, origins and store links are defined in
[`packages/shared/src/config/extensionConfig.ts`](../../packages/shared/src/config/extensionConfig.ts).
Use `EXTENSION_ORIGINS` to look up the production Chrome/Edge, Chrome store
development and local unpacked origins. Deployment CSP and the separate
`app-webview-pages` CAPTCHA bridge maintain their own environment-specific
allowlists; changes to this registry must be applied there explicitly when needed.

### Local preview

Web uses the merged PR's original build artifacts at
`http://localhost:8800/captcha`. The temporary checkout is
`/private/tmp/onekey-turnstile-pr68.FCk1YI`. From that checkout:

```sh
yarn workspaces focus oauth-login-success
yarn workspace oauth-login-success test
python3 /private/tmp/onekey-pr68-server.py
```

The temporary server maps `/captcha` directly to the built HTML, returning
HTTP 200 without a redirect or trailing slash. The three page choices were
visually verified in the real Web login dialog. On 2026-09-21 the test and
production hosted URLs returned HTTP 403 and 404 respectively, so those
deployments were not verified end to end. The client and legacy preview no
longer read a sitekey URL parameter; 46 related tests and the commit check
passed (`node_modules/.cache/agent-checks/2026-09-21T10-02-01-543Z/summary.json`).

Run the app from this repository with `WEB_PORT=3039 yarn app:web`. The Web test
configuration selects the new URL; other targets retain the prior local fixture:

```sh
node development/email-otp-captcha/server.mjs
```

The new page's `timeout` event releases a pending send and makes explicit
Resend available. A retry creates a fresh challenge; ordinary retryable
`error` and `expired` events continue waiting for the provider's recovery UI.
The upstream build and 71 tests passed. Client message, iframe and lifecycle
coverage passed 31 tests, and `yarn agent:check --profile commit` passed:
`node_modules/.cache/agent-checks/2026-09-21T09-46-38-091Z/summary.json`.

In the Web app, switch to wallet mode in Settings > Dev mode > Switch web mode.
Close the first-run onboarding if necessary. Open Dev mode > Gallery > Auth,
or navigate to `http://localhost:3039/dev/component-Auth` after selecting wallet
mode. Use the **Isolated Email OTP + CAPTCHA Test** section.

### Simulate a legacy client without CAPTCHA

Keep CAPTCHA enabled in Supabase, then turn **Client CAPTCHA** off in the test
page. This removes the challenge frame, clears its token and enables the normal
**Send OTP without CAPTCHA** button. That button uses `signInWithOtp` with
`shouldCreateUser: true` and no `captchaToken`, matching the former client
request for both signup and login. The result below the form shows the server
error, HTTP status and whether a session was returned. No token values are
displayed.

The error toast and status display the Supabase `error.message` unchanged,
matching the v6.5.0 login dialog. The request summary shows
`CAPTCHA token omitted`. Turn the switch back on to require a fresh challenge
before the normal send button is enabled. The separate negative-test buttons
remain available for explicit rejection tests.

This verifies enforcement at **OTP issuance**. A previously issued, still-valid
OTP can be submitted through `verifyOtp`, and existing sessions remain valid.
CAPTCHA therefore does not by itself reject every request from an old client
or enforce a minimum client version.

The CAPTCHA server serves only two static test files on port 8799. It accepts
no credentials and records no requests. For a real sitekey, serve the same files
over HTTPS on a hostname registered in the Turnstile widget. The native test
view loads that hosted page without a wallet bridge.

## Supabase setup

### Actual OneKey ID dialog

Open Menu > OneKey ID > Sign In > More sign-in methods. Repeatedly click the
dialog title to reveal the debug panel: three clicks in development builds,
ten otherwise, using the shared `MultipleClickStack` defaults. The email and
verification-code steps both contain server and CAPTCHA controls. The panel
sits below Sign In / Sign Up on the email
step and below the normal actions on the verification-code step, keeping the
ordinary login form separate:

The close icon in the panel's top-right corner hides the panel without changing
the selected server or CAPTCHA configuration. Repeat the title gesture to show
it again. Reopening the login dialog restores defaults and hides the panel.

- **Production / Test1 / Test2** selects the destination.
  Test1 uses `oblqilruyecfnplpkwlp.supabase.co`; Test2 uses
  `zvxscjkvkjepbrjncvzt.supabase.co`. Each shortcut selects its own URL/key pair.
  Publishable keys are built in and are not displayed in the UI.
- **Supabase project URL** switches between the configured production and test
  projects and automatically selects the matching publishable key.
- **Client CAPTCHA** off submits the normal OTP request without a token. On
  makes **Sign In / Sign Up** enter the code step, where verification starts
  below **Next** and then automatically proceeds to OTP issuance. **Resend** also starts a fresh
  challenge before sending. There is no separate CAPTCHA start/reset button in
  the real dialog. The HTML owns its sitekey; the client does not configure it
  or include it in the URL.
- **CAPTCHA page** switches independently between Local
  (`http://localhost:8800/captcha`), Test
  (`https://login.onekeytest.com/captcha`), and Production
  (`https://login.onekey.so/captcha`). Switching cancels any pending challenge
  through the configuration revision and requires explicit Resend on the code
  step. Each frame adds a fresh `requestId` to the fragment. Web also supplies
  `parentOrigin`; native and desktop use their host bridge. Changing this page
  does not change the selected Supabase project.
- **8-digit test OTP** supports the current test project; production keeps six
  digits. Test verification checks `verifyOtp` and `getUser` using an isolated
  memory-only client and does not commit a OneKey ID login or run its success
  continuations.

Configuration changes clear the challenge/token and any entered OTP. On the
code step, switching requires an explicit Resend and does not automatically
send to the newly selected destination. Waiting for CAPTCHA permits changing
configuration or choosing another sign-in method; both cancel the pending send
without an error toast. Only an actual in-flight auth API request locks controls.
Closing/reloading the dialog restores production defaults and the built-in test
preset. These controls are hidden until the title gesture and are absent from
the separate legacy-email dialog.

CAPTCHA rendering and token acquisition belong to the normal login components,
outside the development panel. They use `EMAIL_OTP_CAPTCHA_CONFIG` when no
development override exists. Production currently keeps CAPTCHA disabled until
its own widget and hosted page are configured. The development panel only
overrides the server and CAPTCHA configuration; it is not required by the
business flow. The Gallery retains its separate manual integration controls.
Provider failures, timeouts and closing the dialog cancel the pending request.
Tokens are consumed once, and delayed results from old challenges are ignored.

The real dialog and normal login share `requestEmailOtp`, including the existing
rate-limit handling and the original Supabase business-error message. A real request with CAPTCHA disabled
was observed going to the test project without `captcha_token`, returning
HTTP 400 / `captcha_failed`. The dialog displayed one error toast:
**captcha protection: request disallowed (no captcha_token found)**. It remained on the code step
with Resend available. The header says "Sent to" only after issuance succeeds.
Request failures use the original error toast without an
additional inline request summary.
This round verified the rejection/toast path; the real CAPTCHA positive flow
recorded below was verified in Gallery, not repeated in this dialog.

### v6.5.0 error behavior comparison

Tag `v6.5.0` resolves to `71432893052f677abbda7d9a1a488397c91a4eee`.
Its `useSupabaseAuth.tsx:237` throws `OneKeyLocalError(res.error.message)` after
the cooldown-specific branch. `PrimeLoginEmailCodeDialogV2.tsx:58-65` catches it,
uses `error.message` as the toast title and resets the countdown to zero. Thus
an old client that omits CAPTCHA does display the server's rejection message.

The starting branch had subsequently replaced that message with a generic
localized error; the initial extraction of `requestEmailOtp` retained that
behavior. Following the requested v6.5.0 comparison, server business errors now
retain their original message through the request and toast layers. Existing
cooldown, transient-network and duplicate-toast handling remain in place.
The real Web dialog was re-tested against the CAPTCHA-enabled test project:
HTTP 400 and the original CAPTCHA message were both observed. This is a source
comparison with the tag and a runtime check of the updated local dialog, not
a claim that the historical v6.5.0 binary was launched.

The free organization **OneKey OTP CAPTCHA Test** has been created:
<https://supabase.com/dashboard/org/zgyyhtreohkenumackjt>

The project **onekey-email-otp-captcha-test** is created in Seoul
(`ap-northeast-2`) with the database Data API disabled (only Auth is needed):
<https://supabase.com/dashboard/project/oblqilruyecfnplpkwlp>

Project URL: `https://oblqilruyecfnplpkwlp.supabase.co`.
Turnstile CAPTCHA is enabled with the real **OneKey Email OTP Test** widget,
in Managed mode, allowing only `localhost` and `127.0.0.1`. Pre-clearance is off.
Its secret is stored only in Supabase. The test project's publishable key is
included in `emailOtpTestConfig.ts`; the public Turnstile sitekey is owned by
the hosted HTML (and by `captcha.js` for the legacy local preview). Both the
Gallery and the real dialog send only the request identity and parent origin
to the page. Neither key is shown in the UI. No server-side secrets are stored
in this directory.
Custom SMTP is configured through Resend (`smtp.resend.com:465`). Both signup
confirmation and magic-link templates now contain `{{ .Token }}`. Resend's
testing sender is restricted to the email address of the Resend account owner.

For subsequent runs:

1. Use the prefilled Gallery configuration, or select **Test1** in the
   real dialog. The test project URL and `sb_publishable_` key are built in.
2. Keep custom SMTP configured before editing templates. With the free hosted
   project's default mailer, templates are read-only and contain a magic link.
   The dashboard offers custom SMTP or Pro to enable editing. Configure the
   email templates to contain `{{ .Token }}` so the message
   includes an OTP rather than only a magic link. Check both signup confirmation
   and magic-link templates for new and returning users.
3. Start the local CAPTCHA page server before starting a challenge; the real
   widget sitekey is selected automatically. Supabase CAPTCHA settings are under
   Authentication > Attack Protection.
4. Supply an authorized test recipient. Supabase's default SMTP only sends to
   organization members and currently allows two messages per hour. Use a
   dedicated SMTP configuration for repeated end-to-end tests.

For **separate simulated integration tests only**, the official visible success
sitekey is `1x00000000000000000000AA`; pair it with the official testing secret
`1x0000000000000000000000000000000AA` on the isolated test project. These public
dummy keys simulate results and do not provide real bot protection. Use a real
widget for final human-verification testing.

During initial simulated testing, the always-pass test secret also accepted
the deliberately invalid token. Do not use that configuration to assert token
authenticity. The server rejection branch was separately verified with the
always-fail test secret (`2x0000000000000000000000000000000AA`). Final testing
uses the real widget; missing and fabricated tokens both return `captcha_failed`.

## Verification record — 2026-09-20

| Check | Result |
| --- | --- |
| Web app runs in wallet mode | Observed, Wallet/Browser/Dev mode sidebar visible |
| Test widget renders in the actual Auth Gallery | Passed with official dummy sitekey |
| Success token reaches app UI | Passed; widget and app both show CAPTCHA success |
| Failure callback reaches app UI | Passed with `2x00000000000000000000AB`; app shows CAPTCHA error |
| Message validation tests | 13 passed |
| `yarn agent:check --profile commit` | Passed, including TypeScript |
| Supabase test project created | Passed; isolated project `oblqilruyecfnplpkwlp` |
| CAPTCHA enabled on Supabase | Passed; real Turnstile secret, Managed widget limited to local test hostnames |
| Missing CAPTCHA rejected by Supabase | Passed; `captcha_failed` (400) from Web wallet mode |
| Client CAPTCHA switch off, existing user | Passed through the normal send button; network request omits `captcha_token`, server returns `captcha_failed` (400) |
| Client CAPTCHA switch off, new email | Passed with `shouldCreateUser: true`; network request omits `captcha_token`, server returns `captcha_failed` (400) |
| Client CAPTCHA switched back on | Passed; normal send button disabled until a fresh challenge succeeds |
| Real OneKey ID dialog, client CAPTCHA off | Passed; test endpoint returned `captcha_failed` (400), original Supabase message visibly rendered as in v6.5.0 |
| Real dialog PKCE request after flow alignment | Passed; POST contains a non-empty `code_challenge` and `code_challenge_method: 's256'`, omits `captcha_token`, and still returns 400 with the original error toast |
| Real dialog CAPTCHA switch on/off | Passed on email and code steps; enabled mode gates sending on a fresh token, disabled mode allows the legacy request |
| Real dialog production/test switch | Passed; URL changes visibly, and switching back restores the test publishable key without sending automatically |
| Built-in test keys with no key inputs | Passed in a newly opened real dialog; selecting Test Supabase requires no key entry, CAPTCHA can be enabled without a sitekey input, and the normal OTP request automatically carries the publishable key |
| Built-in CAPTCHA page URL | Passed; the real dialog shows no CAPTCHA URL input when enabled, and the configured local page returns HTTP 200 |
| Provider rejection blocks sending | Passed with always-fail secret; `captcha_failed` (400) |
| Invalid token rejected with real keys | Passed; `captcha_failed` (400), with no auth email accepted |
| Widget token submitted through `signInWithOtp` | Passed; request accepted and CAPTCHA frame/token discarded |
| Email delivered | Resend reports Delivered for the numeric OTP email; recipient inbox placement not inspected |
| Wrong OTP rejected | Passed; `verifyOtp` returned `otp_expired` |
| Numeric OTP verified and authenticated user retrieved | Passed in Web wallet Auth Gallery; `verifyOtp` followed by `getUser` |
| Returning-user OTP login | Passed; second numeric email delivered, OTP and authenticated user verified |
| Real Turnstile challenge | Passed; Managed widget automatically verified the Chrome session without a checkbox |
| Real CAPTCHA → SMTP → OTP → authenticated user | Passed in Web wallet mode; real token accepted, email delivered, `verifyOtp` and `getUser` succeeded |
| iOS | Real CAPTCHA and OTP send passed in the login dialog; numeric OTP entry left to the user |
| Android | Pixel 4 API 36: real Turnstile success and OTP send passed in the login dialog after navigation and emulator GPU fixes |
| Desktop / extension | Not verified; deferred |

The success criterion is a rendered challenge, a returned token, Supabase
accepting the OTP request, delivery to the test mailbox, and successful
`verifyOtp` followed by `getUser`. A rendered component or simulated token alone
is not end-to-end completion. Also verify rejection without a CAPTCHA token,
failed challenge, reset/expiry, wrong OTP, and retry behavior. The test page
discards CAPTCHA tokens after every send attempt, never logs OTP or session
values, and never displays returned session tokens.

The numeric OTP used for verification was read from the authorized Resend sent
email preview without logging its value. Resend reported successful delivery;
the Outlook inbox itself was not opened. This validates SMTP submission and
Supabase session creation, while inbox placement remains unverified.
The real Managed challenge passed automatically in the user's Chrome session.
This verifies integration, not detection of every browser automation tool.

Latest checks: `node_modules/.cache/agent-checks/2026-09-20T09-04-41-253Z/summary.json`.
The test panel was visually verified below Sign In / Sign Up on the email step
and below Next / Choose Another Sign-In Method on the verification-code step.
Its caution background and matching border distinguish it from the normal
form. A bottom margin keeps the border and rounded corners clear of the scroll
container's edge; both steps were visually checked in Web.
After moving CAPTCHA into the business flow, 30 tests across four suites passed,
including normal Resend without development controls, one-use token handling,
provider failure/retry, configuration cancellation, unmount and timeout. The
real dialog shows only Sign In / Sign Up when CAPTCHA is enabled. Live validation
of the newly combined button is pending action-time CAPTCHA confirmation.
Targeted tests cover the OTP request/error mapping, CAPTCHA readiness, explicit
resend after changing servers, existing dialog behavior and message validation
(27 tests across four suites).
After restoring the original error text, 12 tests across the OTP request,
login-code dialog and shared email-OTP dialog suites passed again.
iOS receipt:
`node_modules/.cache/onekey-mobile-dev/sessions/wk-87f956c3ba02-dev-512e9b2598ca-7f684814867dcf0f/run-result.json`.
The shell, vendor and WebEmbed were restored from remote resources with
`userNoticeRequired: false`.

## CAPTCHA retry UX follow-up

Provider error/expiry callbacks keep the current send pending. The official
client keeps its default retry and refresh policies; a later success from
manual Retry or automatic recovery completes that same send exactly once.
Subsequent refresh/success callbacks do not send additional emails. Supabase
request failures keep the existing raw-error toast and explicit Resend behavior.

Web hides the iframe behind a loading placeholder until an origin/window/request-validated
provider message arrives. A browser `load` event is not sufficient because it also
fires for blocked/error documents. If no bridge message arrives within 30 seconds,
the frame reports a load failure. Native uses the same loading placeholder and
30-second bridge deadline, also treating host-page HTTP errors and WebView process
failures as load errors. The shared hook's defensive fallback remains 120 seconds.
SDK/page load failure or startup timeout removes the stalled frame, preserves the
error inline with a Retry action, and makes Resend available. Retry starts a new
challenge and clears the previous error; no OTP request is sent without a token.
Once started, provider recovery has no application-imposed two-minute cutoff;
users can leave the step while waiting. Visible provider success/error results
stay below Next. The header only claims an email was sent after API acceptance.

Regression coverage includes provider retries beyond the old deadline, duplicate
callbacks, stale tokens, cancellation on configuration changes/step exit/unmount,
startup failure, and React StrictMode effect replay (48 tests across five suites).
Browser follow-up submission
was not executed: automatic approval required action-time email-send permission.

## iOS Turnstile loading fix

On iPhone 17 Pro (iOS 26.5), the real login dialog remained on `Verifying…`
and Web Inspector reported repeated Turnstile `300031` errors. The native
WebView's default origin whitelist allowed HTTP(S) and `about:blank`, but
rejected Turnstile's `about:srcdoc` navigation before the application callback.

The CAPTCHA WebView now explicitly includes both internal document URLs in its
origin whitelist. A native navigation trace confirmed `about:srcdoc` reached
the callback after the change. The real widget displayed `Success!`, Supabase
accepted the OTP send, and the dialog displayed the sent state and resend
countdown. Message origin and request-ID checks still apply.

Temporary navigation instrumentation and Web Inspector access were removed.
The native shell used `remote-cache`; Vendor and WebEmbed used `local-cache`.
Run receipt:
`node_modules/.cache/onekey-mobile-dev/sessions/wk-87f956c3ba02-dev-512e9b2598ca-065343e519c1d705/run-result.json`.

## Android Turnstile frame navigation

Android's `onShouldStartLoadWithRequest` payload omits `isTopFrame` (the field
is iOS-only). Treating a missing value as a top frame rejected the Turnstile
iframe and its internal documents. The native CAPTCHA component now accepts
the HTTPS Turnstile origin, `about:blank`, and `about:srcdoc` when frame metadata
is absent. Unknown destinations remain blocked; message origin and challenge
identity checks continue to apply. Regression tests replay Android's missing
frame metadata, including hostile lookalike URLs and known iOS top frames.

The affected navigation callback runs in Android's UI (`main`) runtime. The
native WebView is owned by that UI; the separate `bg` JS heap does not consume
these navigation events. This fix does not require cross-runtime shared state.

The Pixel 4 API 36 simulator currently uses Metro port 8081. The local CAPTCHA
fixture requires `adb -s emulator-5554 reverse tcp:8799 tcp:8799` after each
emulator restart. The native shell used `remote-cache`; Vendor and WebEmbed used
`local-cache`, with `userNoticeRequired: false`.

After the navigation fix, the emulator still crashed in Chromium's native
`Chrome_InProcGp` thread. Logcat captured `eglCreateContext` failing with
`EGL_BAD_CONFIG`, followed by `gl_version_info.cc:73` and `SIGTRAP`. This was a
process-owned GPU backend failure, not communication between the isolated
`main` and `bg` JS heaps. Emulator 35.6.11 was using the Apple M4 Max OpenGL
translator. The local AVD now uses `hw.gpu.mode=swiftshader_indirect` and
`hw.ramSize=4096`; no app data was erased or CAPTCHA checks disabled.

On 2026-09-20, the real Android OneKey ID dialog selected Test Supabase with
Client CAPTCHA on. Sign In / Sign Up rendered the real Managed Turnstile
challenge. Completing its checkbox displayed `Success!`; Supabase accepted
the OTP request to the authorized test mailbox, and the dialog displayed
`Sent to` with a 55-second resend countdown. The app remained in the same
process (PID 4362), and filtered logcat showed no new native fatal errors after
the emulator restart. Mailbox placement and numeric OTP entry were not checked
in this Android run.

The native navigation, message, hook and hosted-page regression suites passed
44 tests. `yarn agent:check --profile commit` passed, including type checking:
`node_modules/.cache/agent-checks/2026-09-20T14-42-56-047Z/summary.json`.
Android run receipt:
`node_modules/.cache/onekey-mobile-dev/sessions/wk-87f956c3ba02-dev-04ab3fc382bf-48572fe597e3d5d1/run-result.json`.
Local evidence: `/private/tmp/onekey-android-captcha-after-check.png`.

## References

- <https://supabase.com/docs/guides/auth/auth-captcha>
- <https://supabase.com/docs/reference/javascript/auth-signinwithotp>
- <https://supabase.com/docs/guides/auth/auth-smtp>
- <https://developers.cloudflare.com/turnstile/troubleshooting/testing/>
- <https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/>
- <https://developer.android.com/studio/run/emulator-acceleration>


### Web CAPTCHA page failure UI (2026-09-21)

Verified in the real OneKey ID dialog on `http://localhost:3039` with the test
Supabase and `https://login.onekeytest.com/captcha` selected: Retry shows a loading
placeholder, the failed document never becomes visible, and the 30-second bridge
deadline restores Resend and shows `CAPTCHA could not load. Please retry.` with
an inline Retry action. Network capture observed zero `/auth/v1/otp` requests.
The remote document returned HTTP 200 with CSP `frame-ancestors 'none'`, and Chrome
blocked embedding with `net::ERR_BLOCKED_BY_RESPONSE`. No hosting security headers
were changed; the UI fallback does not resolve that deployment configuration.


## Host-owned recovery when the CAPTCHA HTML is unreachable

All frame implementations display a host-rendered loading placeholder and start
an independent 30-second deadline. Neither requires the CAPTCHA HTML, bridge, or
Cloudflare script to execute. DNS/TLS failures, offline/connection failures, an
unresponsive server, CSP blocks, and unexpected error/redirect documents converge
on an explicit load failure if no validated bridge response arrives. Native also
handles transport errors, host HTTP errors, and WebView process termination.
Web uses the error capture phase because iframe error events do not bubble.

The dialog removes the stalled frame and displays
`CAPTCHA could not load. Check your network connection and retry.` with an enabled
Retry action. Each retry uses a fresh request ID and deadline; it never sends OTP
without verification. This message suggests checking connectivity without claiming
that every failure is a network outage (server deployment and policy failures can
have the same outcome).

Integration tests mount the actual web/native frame plus the real CAPTCHA hook in
the OTP dialog. They cover no page events, error documents that only emit `load`,
and iframe error capture, asserting Loading before the deadline, error/Retry after
failure, distinct request IDs on consecutive retries, and zero OTP sends. Native
frame tests additionally cover network callbacks, HTTP errors, and process death.
These are deterministic failure-signal tests, not a claim of a live carrier/DNS
fault campaign on every platform. Once the provider has reported readiness, its
existing challenge retry behavior remains unchanged.

Live Web verification used the stopped local CAPTCHA endpoint (port 8800 stayed
closed). DevTools recorded `net::ERR_CONNECTION_REFUSED` for the HTML request.
The real OneKey ID dialog showed the loading placeholder, then the inline network
hint and enabled Retry. Retry returned to the loading state. No real CAPTCHA was
completed in this negative test.


## CAPTCHA status and code entry

Loading and verification status stay in the CAPTCHA area. Resend keeps its
original Processing, countdown and Resend labels. The provider owns retries after
readiness; no additional client timeout or forced reset is added.

The OTP input and Next are disabled while the first CAPTCHA/send is pending, and
enabled after the send API succeeds. A CAPTCHA failure before any send, or an
explicit SDK rejection (`AuthApiError` 400 / `captcha_failed`, or 429 /
`over_email_send_rate_limit`), keeps first-time code entry disabled. Structured
failure metadata survives the existing toast wrapper. Recognized network errors,
timeouts and 5xx also keep first-time entry disabled. Classification uses error
types/codes, never message text; unknown errors allow code entry and submission.
A failed resend restores entry for a previously requested code. Only the
verification API decides whether a submitted code is valid. Changing the
development server clears this state.

## Desktop file renderer and OTA

Desktop uses `CaptchaFrame.desktop.tsx` to load the HTTPS page in an Electron
`<webview>` guest. The CAPTCHA document is the guest's main document, so the
host's `file://` renderer is not its framing ancestor. The hosted CSP and origin
allowlist remain intact; no `file:`, `null`, wildcard target origin, or disabled
web security is required.

The guest preload exposes only the hosted page's existing
`ReactNativeWebView.postMessage` interface. It accepts request-bound CAPTCHA
messages from the approved login origins and sends them through `sendToHost`.
The renderer checks the event's guest, channel, document URL, origin, request ID
and payload before consuming a result. CAPTCHA documents do not receive wallet
providers. Ordinary DApp documents retain the existing provider preload.

`development/scripts/build-desktop-webview-preload.js`, called by `copy:inject`,
composes the guest bridge and existing provider into `static/preload.js` before
renderer metadata is generated. The installed shell's existing
`getPreloadJsContent` API resolves and integrity-checks this OTA resource.
Neither the Electron main process nor its main-window preload changes. OTA
delivery must include this static file and its matching metadata together with
the renderer; replacing only the application JavaScript is insufficient.

The host shows Loading CAPTCHA until a validated page message arrives. Preload
lookup failures, HTTP/transport errors, unexpected navigation and guest process
termination fail the attempt; a 30-second deadline also covers silent failures.
The failed guest is removed and the existing dialog displays its network hint
and Retry. After readiness, the hosted page owns challenge recovery. Resend
labels and the existing OTP input gating are unchanged.

Compatibility verification uses the unmodified 6.6.0 `app.asar` and matching
Electron 43.1.1, an isolated profile, and a renderer loaded from `file://`.
This checks the old shell APIs; it does not substitute for deployment and
installation of a signed production OTA bundle.

On 2026-09-22, the real file renderer was tested against the stopped localhost
CAPTCHA server. Both the initial attempt and Retry produced
`ERR_CONNECTION_REFUSED` in the guest log and the inline network hint with an
enabled Retry; code entry and Next stayed disabled. Each attempt acquired the
new preload through the unmodified 6.6.0 shell API.

The hosted positive flow was subsequently completed in the same real dialog
using Test1 and `https://login.onekeytest.com/captcha`. The guest visibly showed
Turnstile `Success!`; the dialog displayed `Sent to` and the resend countdown.
Runtime logs recorded HTTP 200 from `/auth/v1/otp`, then `/auth/v1/verify` and
`/auth/v1/user` after the user entered the emailed code and confirmed success.
No OTP or token values were captured in this record. The QA and installed 6.6.0
`app.asar` archives have identical SHA-256 digests; the generated OTA metadata
also matches the composed preload's SHA-512 digest. Signed OTA installation and
Windows remain untested.
