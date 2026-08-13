import * as pbkdf2Module from '../pbkdf2';
import * as pbkdf2WebOnlyModule from '../pbkdf2.web-only';

describe('pbkdf2 module variants', () => {
  // Bundlers resolve pbkdf2.web-only.ts ahead of pbkdf2.ts on web builds, so
  // an export missing from either file becomes an undefined import at runtime.
  it('web-only variant exports the same API surface', () => {
    expect(Object.keys(pbkdf2WebOnlyModule).toSorted()).toEqual(
      Object.keys(pbkdf2Module).toSorted(),
    );
  });

  it.each([
    ['pbkdf2.ts', pbkdf2Module],
    ['pbkdf2.web-only.ts', pbkdf2WebOnlyModule],
  ])(
    '%s non-db-tx no-cache params disable the cache on every platform',
    (_name, mod) => {
      const params = mod.getPbkdf2KdfParamsForNonDbTxNoCache();
      expect(params.enablePbkdf2Cache).toBe(false);
    },
  );

  it('reuses the cached value when the cache is enabled', async () => {
    const password = Buffer.from('pbkdf2-cache-test-password');
    const salt = Buffer.from('pbkdf2-cache-test-salt');
    const probeIds = ['pbkdf2-cache-probe-1', 'pbkdf2-cache-probe-2'];
    pbkdf2Module.clearPbkdf2Cache();
    probeIds.forEach((id) => pbkdf2Module.clearPbkdf2InvocationByProbeId(id));

    for (const debugCryptoProbeId of probeIds) {
      await pbkdf2Module.pbkdf2({
        password,
        salt,
        iterations: 2,
        enableCache: true,
        debugCryptoProbeId,
      });
    }

    // Second call must hit the cache, so its probe never reaches a backend.
    expect(
      pbkdf2Module.getPbkdf2InvocationByProbeId(probeIds[0]),
    ).toBeDefined();
    expect(
      pbkdf2Module.getPbkdf2InvocationByProbeId(probeIds[1]),
    ).toBeUndefined();

    pbkdf2Module.clearPbkdf2Cache();
    probeIds.forEach((id) => pbkdf2Module.clearPbkdf2InvocationByProbeId(id));
  });

  it('recomputes on every call when the cache is disabled', async () => {
    const password = Buffer.from('pbkdf2-no-cache-test-password');
    const salt = Buffer.from('pbkdf2-no-cache-test-salt');
    const probeIds = ['pbkdf2-no-cache-probe-1', 'pbkdf2-no-cache-probe-2'];
    pbkdf2Module.clearPbkdf2Cache();
    probeIds.forEach((id) => pbkdf2Module.clearPbkdf2InvocationByProbeId(id));

    for (const debugCryptoProbeId of probeIds) {
      await pbkdf2Module.pbkdf2({
        password,
        salt,
        iterations: 2,
        enableCache: false,
        debugCryptoProbeId,
      });
    }

    probeIds.forEach((id) => {
      expect(pbkdf2Module.getPbkdf2InvocationByProbeId(id)).toBeDefined();
    });

    probeIds.forEach((id) => pbkdf2Module.clearPbkdf2InvocationByProbeId(id));
  });
});
