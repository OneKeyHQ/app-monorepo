export interface ITradingViewEmbedRelease {
  // SRI digest of the release's exact embed-manifest.json bytes.
  manifestIntegrity: string;
  version: string;
}

// The Web DOM runtime executes these releases in the wallet origin, so each
// chart origin is pinned to one reviewed release. Origins without a release
// keep the cross-origin iframe.
//
// To pin a published release:
//   curl -fsS https://<host>/<version>/embed/embed-manifest.json \
//     | openssl dgst -sha384 -binary | openssl base64 -A
export const TRADING_VIEW_EMBED_PINNED_RELEASES: Readonly<
  Record<string, ITradingViewEmbedRelease | undefined>
> = {
  // No embed release has been published to the production host yet.
  'https://tradingview.onekey.so': undefined,
  'https://tradingview.onekeytest.com': {
    version: '4bb66bdc7e02158db055baeddf821a06e4f86513',
    manifestIntegrity:
      'sha384-DMGUUc+Xg7NNqslxsgoJFM6OyrOuFf8YakCgRLe9ypFzNkf7f5Qkog64feW1bKg2',
  },
};
