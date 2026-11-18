# Vendored Stripe.js

`index.js` is the current runtime. `faulty-before-13914.js` is the original
runtime from `8168a58d82a^`, before PR #13914 refreshed Stripe.js on 2026-10-15.
The historical file is preserved byte for byte, including the existing
`_ensureStripeHosted` adaptation. Its SHA-256 is
`c85b410fd4e558f9b57832712a8659a59c608bf23269dbc1c771a65f15e5ef46`.

That version references retired Stripe iframe scripts. Developer settings can
select it on Web, Desktop and extension to reproduce the real loading failure
and exercise the normal hosted-checkout fallback. The setting does not inject
an error or call fallback directly. The Android web-embed keeps the current
runtime.

The Stripe choice is cached before RevenueCat's SDK loads. Both overrides are
off by default. Changing either switch in developer settings saves its value
and automatically restarts the app. Disabling developer mode also restarts
when either override was on, so cached overrides cannot survive that change.
For a fallback test, disable
“Prime 信用卡外链支付” and enable “切换到故障版本的 Stripe.js”. If the
Payment Element loading fails or does not become ready within 30 seconds,
the app closes that purchase's embedded form through RevenueCat's cancel
control, then opens the hosted checkout through the normal fallback. Closing
a blank form manually still offers the hosted checkout for confirmation.
Once the form has rendered, payment errors do not open a second checkout.

Desktop also observes actual HTTP responses for Stripe form resources in the
Electron main process. A 403 from a request started during the current checkout
immediately takes the same cancellation/fallback path, without waiting for the
30-second timeout. Requests from other windows, older checkouts, and failures
after the form is ready cannot trigger this path. Stripe response headers are
left untouched, and only the status and request start time cross IPC.

“Prime 信用卡外链支付” retains priority: it skips both Stripe versions and
opens the RevenueCat Purchase Link directly, even if the faulty-version
setting is also enabled. With developer mode disabled, both overrides are
ignored and the current embedded runtime is used.

The embedded Web/Desktop/extension checkout mounts into an app-owned container
via the SDK's `htmlTarget` option. Its browser-payment action reuses existing
translations, asks for confirmation before leaving the embedded form, and
cancels through the SDK's own close control. Dismissing that confirmation keeps
the current form open. On phone-width screens the app container fills the
viewport, with a scrollable form and a persistent browser-payment action.
The hosted flow
starts only after the SDK acknowledges cancellation, clears its target, and
the app container closes. A captured form submission permanently disables
switching for that attempt, even if a later payment error appears. No SDK
patch or Stripe iframe modification is required.
