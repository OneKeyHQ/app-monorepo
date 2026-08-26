# App link verification files

The files in this directory are copied into the web build by
`apps/web/postbuild.sh`:

- `deeplink.ios.json` -> `web-build/.well-known/apple-app-site-association`
- `deeplink.android.json` -> `web-build/.well-known/assetlinks.json`

They are served **only** on the hosts this web app is deployed to:
`app.onekey.so` (production) and `app.onekeytest.com` (test).

## Why the dedicated app-link hosts are NOT covered here

iOS and Android resolve verification files **per domain**: for
`stocks.onekey.so`, the system fetches
`https://stocks.onekey.so/.well-known/apple-app-site-association` — never the
file on `app.onekey.so`. The dedicated entry hosts (`stocks.onekey.so`,
`perps.onekey.so`, `swap.onekey.so` and the onekeytest variants) are pure
redirect domains hosted by ops infrastructure outside this repository, and
each serves its own verification files (host-level allow rules). See
`docs/ok-57529-ops-app-links.md` and OK-57528 for the ops-side source of
truth.

So the rules in `deeplink.ios.json` intentionally cover only the
`app.onekey.*` paths (`/account/*`, `/wc/*`, `/swap?tab=stock`, `/perps`,
`/market`, and trailing-slash variants). Adding rules for other hosts here
would have no effect.

## Verifying what platforms actually see

```bash
# iOS: what Apple's CDN holds for a host (devices fetch from here at install)
curl https://app-site-association.cdn-apple.com/a/v1/<host>

# Android: Google's Digital Asset Links validation for a host
curl "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://<host>&relation=delegate_permission/common.handle_all_urls"
```

Note: Apple's CDN is pull-based (up to ~24h to pick up changes; failures are
negatively cached) and devices refresh at app install/update time.
