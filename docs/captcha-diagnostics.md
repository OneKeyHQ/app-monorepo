# Email OTP CAPTCHA diagnostics

Export the app's local logs using the existing Settings log export action.
Search for `prime => subscription => emailOtpCaptchaDiagnostic`, then group
lines by `requestId`. This event uses `@LogToLocal()` in production; it does
not add a server analytics event. Web/extension use ServiceLogger, native uses
the native file logger, and desktop uses the Electron file logger.

The tracker runs in the UI (`main`) runtime. On iOS/Android and extension the
background runtime has a separate JS heap; web/desktop use a single JS runtime.
The existing logger transports own persistence/export; no new storage, native
resource, or background initialization ordering is introduced.

| Field | Interpretation |
| --- | --- |
| `requestId` | Random local UUID v4 for this challenge, shared with its bridge; never an identity/session token |
| `status` | `start`, `ready`, `error`, `expired`, `load-error`, `timeout`, `cancel`, `success` |
| `source` | `app_request`, `app_watchdog`, `provider_message`, `host_load_error`, `host_watchdog`, `app_cancel`, `app_cleanup` |
| `code` | Original six-digit provider code when supplied; otherwise `null`, including malformed codes |
| `elapsedMs` | Milliseconds since challenge creation, bounded to 2,147,483,647 |
| `readyReceived` / `readyElapsedMs` | Whether/when a validated `ready` bridge message arrived (null before ready) |
| `terminal` | Whether this callback settles the waiting challenge |
| `sequence` | Emitted event order within this request |
| `suppressedEvents` | Cumulative repeated/over-budget intermediate callbacks omitted so far |

`ready` means the hosted page reported provider startup. It does **not** prove
that the provider iframe painted, was visible, or was seen by the user. Other
provider callbacks may arrive without an explicit ready message.

`app_watchdog` is the existing 120-second app deadline. Validated provider
callbacks clear it as before. `host_watchdog` is the frame's existing 30-second
startup deadline, reported with status `load-error`. `host_load_error` denotes
a local frame/bridge/preload/load/navigation/process failure; it is deliberately
coarse and carries no raw exception, URL, browser error, or HTTP status.

`provider_message` means a validated hosted-page callback. A `timeout` with
`code: "110620"` preserves that Cloudflare error. A timeout without a code
cannot identify whether Cloudflare's timeout callback or another hosted-page
path produced it. Do not infer a missing code. Likewise, `status` is the bridge
status, not an HTTP response status. No hosted-page deployment is required.

Retryable errors (including 300xxx/600xxx) and expiry remain nonterminal and
keep provider recovery active. Error codes do not change retry, OTP sending,
verification, cancellation, or timeout behavior. Start, first ready and settlement
are reserved; at most eight distinct intermediate status/source/code combinations
are logged per attempt (at most eleven lines total). Repeats are deduplicated
even when alternating; settlement includes the cumulative suppressed count.
Stale, already settled and unrelated request IDs are ignored. Cleanup cancellation
covers both unmount and dependency/configuration changes and is not claimed to
distinguish them. Cached-token consumption creates no new challenge event.

Only the documented scalar fields cross the final logger boundary. No CAPTCHA
token, OTP, email, login/refresh token, secret/API key, URL/query, full user agent,
raw message, Error or bridge object is logged. Request IDs must match the current
locally generated UUID; enum, code, length and numeric validation are enforced
before local serialization. Existing generic login failure analytics are unchanged
and receive none of these new diagnostic fields.
