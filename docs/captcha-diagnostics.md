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
| `elapsedMs` | Nonnegative integer milliseconds since challenge creation, bounded to 2,147,483,647 |
| `readyReceived` / `readyElapsedMs` | Whether/when a validated `ready` bridge message arrived (null before ready) |
| `terminal` | Whether this callback settles the waiting challenge |
| `sequence` | Log-call attempt order within this request (1–11, including a call that throws) |
| `suppressedEvents` | Cumulative repeated/over-budget callbacks omitted so far, capped at Number.MAX_SAFE_INTEGER |

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
are retained. Each challenge has a hard maximum of eleven diagnostic log calls,
including calls that throw. Start is idempotent, and a slot is reserved for the
single terminal summary even under repeated starts or reentrant logger calls.
The signature Set retains at most eight entries. Repeats are deduplicated even
when alternating; settlement includes the cumulative suppressed count. Once
closed, further callbacks are ignored. A logger failure consumes its slot and
is never retried or logged as a raw exception; it must not affect authentication.
Persistence remains best-effort when the existing logger transport is failing.
Stale, already settled and unrelated request IDs are ignored. Cleanup cancellation
covers both unmount and dependency/configuration changes and is not claimed to
distinguish them. Cached-token consumption creates no new challenge event.

Normal success remains three events: start, ready, success (two without an
explicit ready callback). Each new request receives its own budget: N challenges
can produce at most 11N calls of this event. There is no cross-request/session/time
window limit. The hook serializes pending challenges; the login dialog also has
in-flight/initial-send guards, a 60-second countdown after success, and requires
explicit retry after a failure while visible. A global log limiter would hide
independent user retries; no automated new-challenge retry loop was found.

Timing uses performance.now when available at creation, with a fixed clock origin
for the challenge. Wall-clock changes do not affect that duration. Failed clock
reads keep the previous duration until the same source recovers. If no monotonic
clock is initially available, Date.now is the fallback, clamped to a nondecreasing
duration; it cannot distinguish a forward wall-clock adjustment from real elapsed
time. If no initial clock is usable, duration remains zero. Platform monotonic
clocks may pause during system sleep; this is diagnostic timing, not an OTP deadline.

Only the documented scalar fields cross the final logger boundary. No CAPTCHA
token, OTP, email, login/refresh token, secret/API key, URL/query, full user agent,
raw message, Error or bridge object is logged. Request IDs must match the current
locally generated UUID; enum, code, length and numeric validation are enforced
before local serialization. Existing generic login failure analytics are unchanged
and receive none of these new diagnostic fields.
