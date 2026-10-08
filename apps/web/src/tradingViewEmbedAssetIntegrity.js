export const TRADINGVIEW_EMBED_ASSET_MAX_BYTES = 8 * 1024 * 1024;

export class TradingViewEmbedAssetIntegrityError extends Error {
  constructor(code) {
    super('TradingView embed asset integrity verification failed');
    this.name = 'TradingViewEmbedAssetIntegrityError';
    this.code = code;
  }
}

function createSizeError(code) {
  return new TradingViewEmbedAssetIntegrityError(code);
}

function getContentLength(response) {
  const value = response.headers.get('Content-Length');
  if (value === null) {
    return undefined;
  }
  const normalizedValue = value.trim();
  if (!/^\d+$/.test(normalizedValue)) {
    throw createSizeError('tradingview_asset_size_mismatch');
  }
  const contentLength = Number(normalizedValue);
  if (!Number.isSafeInteger(contentLength)) {
    throw createSizeError('tradingview_asset_size_limit_exceeded');
  }
  return contentLength;
}

function verifyDeclaredSize(response, expectedSize) {
  if (
    !Number.isSafeInteger(expectedSize) ||
    expectedSize < 0 ||
    expectedSize > TRADINGVIEW_EMBED_ASSET_MAX_BYTES
  ) {
    throw createSizeError('tradingview_asset_size_limit_exceeded');
  }
  const contentLength = getContentLength(response);
  if (contentLength === undefined) {
    return;
  }
  if (contentLength > TRADINGVIEW_EMBED_ASSET_MAX_BYTES) {
    throw createSizeError('tradingview_asset_size_limit_exceeded');
  }
  const contentEncoding = response.headers
    .get('Content-Encoding')
    ?.toLowerCase();
  const canCompareEncodedLength =
    contentEncoding === 'identity' ||
    (!contentEncoding && response.type !== 'cors');
  if (canCompareEncodedLength && contentLength !== expectedSize) {
    throw createSizeError('tradingview_asset_size_mismatch');
  }
}

async function cancelReader(reader) {
  try {
    await reader.cancel();
  } catch {
    // The original verification error must win over cancellation failures.
  }
}

async function readExactResponseBytes(response, expectedSize) {
  const reader = response.body?.getReader();
  if (!reader) {
    if (expectedSize === 0) {
      return new Uint8Array();
    }
    throw createSizeError('tradingview_asset_size_mismatch');
  }
  const bytes = new Uint8Array(expectedSize);
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        const nextOffset = offset + value.byteLength;
        if (nextOffset > expectedSize) {
          await cancelReader(reader);
          throw createSizeError('tradingview_asset_size_mismatch');
        }
        bytes.set(value, offset);
        offset = nextOffset;
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (offset !== expectedSize) {
    throw createSizeError('tradingview_asset_size_mismatch');
  }
  return bytes;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return globalThis.btoa(binary);
}

function createVerifiedResponse(response, bytes) {
  const headers = new Headers(response.headers);
  headers.delete('Content-Encoding');
  headers.delete('Content-Length');
  return new Response(bytes.byteLength > 0 ? bytes : null, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export async function verifyTradingViewEmbedAssetResponse(response, asset) {
  verifyDeclaredSize(response, asset.size);
  if (!globalThis.crypto?.subtle) {
    throw new TradingViewEmbedAssetIntegrityError(
      'integrity_crypto_unavailable',
    );
  }
  const bytes = await readExactResponseBytes(response, asset.size);
  const digest = await globalThis.crypto.subtle.digest('SHA-384', bytes);
  const actualIntegrity = `sha384-${arrayBufferToBase64(digest)}`;
  if (actualIntegrity !== asset.integrity) {
    throw new TradingViewEmbedAssetIntegrityError('integrity_mismatch');
  }
  return createVerifiedResponse(response, bytes);
}
