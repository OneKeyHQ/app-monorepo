/* cspell:ignore unhandle */
import {
  PROTOCOL,
  clearProtocolHandlerIfNeeded,
  createBufferResponse,
  getMimeTypeForPath,
} from './protocol';

describe('protocol helpers', () => {
  test('getMimeTypeForPath maps web and media extensions and falls back to octet-stream', () => {
    expect(getMimeTypeForPath('index.html')).toBe('text/html; charset=utf-8');
    expect(getMimeTypeForPath('bundle.js')).toBe(
      'application/javascript; charset=utf-8',
    );
    expect(getMimeTypeForPath('core.wasm')).toBe('application/wasm');
    expect(getMimeTypeForPath('hero.avif')).toBe('image/avif');
    expect(getMimeTypeForPath('clip.mp4')).toBe('video/mp4');
    expect(getMimeTypeForPath('sound.ogg')).toBe('audio/ogg');
    expect(getMimeTypeForPath('unknown.xyz')).toBe('application/octet-stream');
  });

  test('createBufferResponse returns 200 with Content-Length and Accept-Ranges', async () => {
    const buf = Buffer.from('0123456789', 'utf8');
    const res = createBufferResponse(buf, '/static/clip.mp4');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('content-length')).toBe('10');
    expect(await res.text()).toBe('0123456789');
  });

  test('createBufferResponse serves 206 Partial Content for byte ranges and 416 for unsatisfiable ranges', async () => {
    const buf = Buffer.from('0123456789', 'utf8');

    const resPartial = createBufferResponse(buf, '/static/clip.mp4', {
      headers: new Headers({ Range: 'bytes=2-5' }),
    });
    expect(resPartial.status).toBe(206);
    expect(resPartial.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(resPartial.headers.get('content-length')).toBe('4');
    expect(await resPartial.text()).toBe('2345');

    const resOpenEnd = createBufferResponse(buf, '/static/clip.mp4', {
      headers: new Headers({ Range: 'bytes=7-' }),
    });
    expect(resOpenEnd.status).toBe(206);
    expect(resOpenEnd.headers.get('content-range')).toBe('bytes 7-9/10');
    expect(await resOpenEnd.text()).toBe('789');

    const resSuffix = createBufferResponse(buf, '/static/clip.mp4', {
      headers: new Headers({ Range: 'bytes=-3' }),
    });
    expect(resSuffix.status).toBe(206);
    expect(resSuffix.headers.get('content-range')).toBe('bytes 7-9/10');
    expect(await resSuffix.text()).toBe('789');

    const resInvalid = createBufferResponse(buf, '/static/clip.mp4', {
      headers: new Headers({ Range: 'bytes=20-30' }),
    });
    expect(resInvalid.status).toBe(416);
    expect(resInvalid.headers.get('content-range')).toBe('bytes */10');
  });

  test('clearProtocolHandlerIfNeeded clears both protocol.handle and legacy interceptFileProtocol', () => {
    const unhandle = jest.fn();
    const uninterceptProtocol = jest.fn();
    const cleared = clearProtocolHandlerIfNeeded(
      {
        isProtocolHandled: () => true,
        unhandle,
        isProtocolIntercepted: () => true,
        uninterceptProtocol,
      },
      PROTOCOL,
    );
    expect(cleared).toBe(true);
    expect(unhandle).toHaveBeenCalledWith(PROTOCOL);
    expect(uninterceptProtocol).toHaveBeenCalledWith(PROTOCOL);
  });
});
