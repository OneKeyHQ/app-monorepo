const { auditDesktopMainBundle } = require('./electron-runtime-integrity');

const bootstrapMarkers = `
  captureNodeRuntimeBaseline();
  repairProtectedNodeRuntime();
  process.env.ONEKEY_NODE_RUNTIME_INTEGRITY_HARNESS_OUTPUT;
`;

describe('desktop Electron main runtime integrity lint', () => {
  it('accepts a guarded Buffer fallback', () => {
    const source = `${bootstrapMarkers}
      if (typeof globalScope.Buffer === "undefined") {
        globalScope.Buffer = RuntimeBuffer;
      }
    `;
    expect(auditDesktopMainBundle(source)).toEqual([]);
  });

  it('rejects an unconditional Buffer replacement', () => {
    const source = `${bootstrapMarkers}
      globalThis.Buffer = RuntimeBuffer;
    `;
    expect(auditDesktopMainBundle(source)).toContain(
      'Unprotected Electron main global write: globalThis.Buffer',
    );
  });

  it('rejects writes to other protected Node globals', () => {
    const source = `${bootstrapMarkers}
      global.crypto ??= cryptoPolyfill;
      globalScope["process"] ||= processPolyfill;
    `;
    expect(auditDesktopMainBundle(source)).toEqual(
      expect.arrayContaining([
        'Unprotected Electron main global write: global.crypto',
        'Unprotected Electron main bracket global write: globalScope[process]',
      ]),
    );
  });

  it('rejects reflective writes and deletes of protected globals', () => {
    const source = `${bootstrapMarkers}
      Object.defineProperty(globalThis, 'crypto', { value: cryptoPolyfill });
      Reflect.set(global, 'process', processPolyfill);
      delete globalThis.fetch;
    `;
    expect(auditDesktopMainBundle(source)).toEqual(
      expect.arrayContaining([
        'Unprotected Electron main defineProperty write: globalThis.crypto',
        'Unprotected Electron main Reflect.set write: global.process',
        'Unprotected Electron main global delete: globalThis.fetch',
      ]),
    );
  });

  it('accepts only the named canonical Buffer repair', () => {
    const source = `${bootstrapMarkers}
      function repairProtectedNodeRuntime(baseline) {
        Object.defineProperty(globalThis, 'Buffer', {
          value: NativeBuffer,
        });
      }
    `;
    expect(auditDesktopMainBundle(source)).toEqual([]);
  });

  it('rejects protected native prototype mutation', () => {
    const source = `${bootstrapMarkers}
      Buffer.prototype.slice ||= patchedSlice;
      Object.defineProperty(Promise.prototype, 'then', {
        value: patchedThen,
      });
    `;
    expect(auditDesktopMainBundle(source)).toEqual(
      expect.arrayContaining([
        'Protected Electron main prototype mutation: Buffer.prototype.slice',
        'Protected Electron main prototype defineProperty mutation: Promise.prototype.then',
      ]),
    );
  });

  it('requires the runtime bootstrap to remain in the built entry', () => {
    expect(auditDesktopMainBundle('const app = true;')).toEqual(
      expect.arrayContaining([
        'Missing Node runtime integrity bootstrap marker: captureNodeRuntimeBaseline',
        'Missing Node runtime integrity bootstrap marker: repairProtectedNodeRuntime',
      ]),
    );
  });
});
