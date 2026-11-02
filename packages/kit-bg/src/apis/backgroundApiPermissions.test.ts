import { markWebEmbedChannelPayload } from '@onekeyhq/shared/src/utils/webEmbedChannelUtils';

import { EAtomNames } from '../states/jotai/atomNames';

import {
  isBackgroundApiAtomWritable,
  isProviderApiPrivateOriginDenied,
  isWebEmbedChannelRequest,
} from './backgroundApiPermissions';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

describe('backgroundApiPermissions', () => {
  it('blocks UI writes to the background-owned Unifold recipient', () => {
    expect(
      isBackgroundApiAtomWritable(EAtomNames.perpsUnifoldActiveRecipientAtom),
    ).toBe(false);
  });

  it('blocks UI writes to the inscription protection control', () => {
    expect(
      isBackgroundApiAtomWritable(
        EAtomNames.inscriptionProtectionControlPersistAtom,
      ),
    ).toBe(false);
  });

  it('keeps regular cross-runtime atoms writable', () => {
    expect(isBackgroundApiAtomWritable(EAtomNames.settingsPersistAtom)).toBe(
      true,
    );
  });
});

describe('isProviderApiPrivateOriginDenied', () => {
  it.each([
    ['wallet_openPrimeSubscription', 'https://app.onekey.so', false],
    ['wallet_openPrimeSubscription', 'https://app.onekeytest.com', false],
    ['wallet_openPrimeSubscription', 'https://1key.so', false],
    ['wallet_openPrimeSubscription', 'https://evil.example', true],
    ['wallet_openPrimeSubscription', 'https://docs.onekey.so', true],
    ['wallet_primeWebCheckoutReturn', 'https://app.onekey.so', false],
    ['wallet_primeWebCheckoutReturn', 'https://app.onekeytest.com', false],
    ['wallet_primeWebCheckoutReturn', 'https://pay.rev.cat', true],
    ['wallet_primeWebCheckoutReturn', 'https://docs.onekey.so', true],
    ['wallet_keylessGetStatus', 'https://app.onekey.so', false],
    ['wallet_keylessGetStatus', 'https://evil.example', true],
    ['wallet_getConnectWalletInfo', 'https://evil.example', false],
  ])('method=%s origin=%s denied=%s', (method, origin, denied) => {
    expect(isProviderApiPrivateOriginDenied({ method, origin })).toBe(denied);
  });
});

describe('web-embed channel mark', () => {
  const page = (origin: string, extra: Record<string, unknown> = {}) =>
    ({
      origin,
      scope: '$private',
      data: { method: 'fetchStream' },
      ...extra,
    }) as unknown as IJsBridgeMessagePayload;

  it('accepts only the host-marked web-embed page at its own origin', () => {
    expect(
      isWebEmbedChannelRequest(markWebEmbedChannelPayload(page('null'), true)),
    ).toBe(true);
  });

  it('rejects a dApp data: iframe that reports the opaque origin "null"', () => {
    expect(isWebEmbedChannelRequest(page('null'))).toBe(false);
    expect(
      isWebEmbedChannelRequest(markWebEmbedChannelPayload(page('null'), false)),
    ).toBe(false);
  });

  it('drops a mark the page forged itself', () => {
    const forged = page('null', { $onekeyWebEmbedChannel: true });
    const forwarded = markWebEmbedChannelPayload(forged, false);
    expect(isWebEmbedChannelRequest(forwarded)).toBe(false);
    expect(forwarded).not.toHaveProperty('$onekeyWebEmbedChannel');
    expect(forwarded.data).toBe(forged.data);
  });

  it('keeps a third-party frame inside the web-embed WebView out', () => {
    expect(
      isWebEmbedChannelRequest(
        markWebEmbedChannelPayload(page('https://js.stripe.com'), true),
      ),
    ).toBe(false);
  });

  it('forwards unmarked payloads (Prime modal, dApps) as the same object', () => {
    const prime = page('null', {
      data: { method: 'webembedPrivateRequest_closeWebViewModal' },
    });
    expect(markWebEmbedChannelPayload(prime, false)).toBe(prime);
  });
});
