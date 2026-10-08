import { createHash } from 'node:crypto';

import {
  TRADINGVIEW_EMBED_ASSET_MAX_BYTES,
  verifyTradingViewEmbedAssetResponse,
} from './tradingViewEmbedAssetIntegrity';

function createAsset(body, size = new TextEncoder().encode(body).byteLength) {
  return {
    file: 'entry.js',
    integrity: `sha384-${createHash('sha384').update(body).digest('base64')}`,
    size,
  };
}

describe('verifyTradingViewEmbedAssetResponse', () => {
  test('accepts a response with the declared size and integrity', async () => {
    const body = 'verified asset';
    const response = new Response(body, {
      headers: { 'Content-Length': String(body.length) },
    });

    const verifiedResponse = await verifyTradingViewEmbedAssetResponse(
      response,
      createAsset(body),
    );

    await expect(verifiedResponse.text()).resolves.toBe(body);
  });

  test('rejects an asset whose declared size exceeds the hard limit', async () => {
    const body = 'oversized manifest entry';

    await expect(
      verifyTradingViewEmbedAssetResponse(
        new Response(body),
        createAsset(body, TRADINGVIEW_EMBED_ASSET_MAX_BYTES + 1),
      ),
    ).rejects.toMatchObject({
      code: 'tradingview_asset_size_limit_exceeded',
    });
  });

  test('rejects a mismatched identity Content-Length before hashing', async () => {
    const body = 'unexpected body';

    await expect(
      verifyTradingViewEmbedAssetResponse(
        new Response(body, { headers: { 'Content-Length': '1' } }),
        createAsset(body),
      ),
    ).rejects.toMatchObject({ code: 'tradingview_asset_size_mismatch' });
  });

  test('does not compare compressed Content-Length with decoded size', async () => {
    const body = 'decoded response body';

    await expect(
      verifyTradingViewEmbedAssetResponse(
        new Response(body, {
          headers: {
            'Content-Encoding': 'gzip',
            'Content-Length': '10',
          },
        }),
        createAsset(body),
      ),
    ).resolves.toBeInstanceOf(Response);
  });

  test('rejects a streamed body that exceeds the declared size', async () => {
    const body = 'larger than declared';

    await expect(
      verifyTradingViewEmbedAssetResponse(
        new Response(body),
        createAsset(body, body.length - 1),
      ),
    ).rejects.toMatchObject({ code: 'tradingview_asset_size_mismatch' });
  });

  test('rejects a streamed body shorter than the declared size', async () => {
    const body = 'short body';

    await expect(
      verifyTradingViewEmbedAssetResponse(
        new Response(body),
        createAsset(body, body.length + 1),
      ),
    ).rejects.toMatchObject({ code: 'tradingview_asset_size_mismatch' });
  });

  test('still rejects an exact-size response with the wrong digest', async () => {
    const body = 'same size body';
    const asset = createAsset('different text');

    await expect(
      verifyTradingViewEmbedAssetResponse(new Response(body), asset),
    ).rejects.toMatchObject({ code: 'integrity_mismatch' });
  });
});
