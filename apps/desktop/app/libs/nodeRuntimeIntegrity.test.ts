/** @jest-environment node */

import { Buffer as NativeBuffer } from 'node:buffer';

import {
  auditCanonicalNodeGlobals,
  auditNodeRuntime,
  captureNodeRuntimeBaseline,
  repairProtectedNodeRuntime,
} from './nodeRuntimeIntegrity';

describe('nodeRuntimeIntegrity', () => {
  const nativeBufferDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'Buffer',
  );
  const nativeSetImmediate = globalThis.setImmediate;

  afterEach(() => {
    if (nativeBufferDescriptor) {
      Object.defineProperty(globalThis, 'Buffer', nativeBufferDescriptor);
    }
    globalThis.setImmediate = nativeSetImmediate;
  });

  it('starts from canonical Node globals', () => {
    expect(auditCanonicalNodeGlobals()).toEqual([]);
  });

  it('detects and repairs a foreign global Buffer implementation', () => {
    const baseline = captureNodeRuntimeBaseline();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const polyfillBuffer = require('buffer/').Buffer as typeof NativeBuffer;

    Object.defineProperty(globalThis, 'Buffer', {
      ...nativeBufferDescriptor,
      value: polyfillBuffer,
    });

    expect(auditNodeRuntime(baseline)).toContainEqual({
      name: 'global.Buffer',
    });
    expect(NativeBuffer.isBuffer(NativeBuffer.from('probe'))).toBe(true);
    expect(polyfillBuffer.isBuffer(NativeBuffer.from('probe'))).toBe(false);

    expect(repairProtectedNodeRuntime(baseline)).toEqual([
      { name: 'global.Buffer' },
    ]);
    expect(globalThis.Buffer).toBe(NativeBuffer);
    expect(auditNodeRuntime(baseline)).toEqual([]);
  });

  it('reports non-allowlisted API drift without silently repairing it', () => {
    const baseline = captureNodeRuntimeBaseline();
    globalThis.setImmediate = ((...args: Parameters<typeof setImmediate>) =>
      nativeSetImmediate(...args)) as typeof setImmediate;

    expect(auditNodeRuntime(baseline)).toContainEqual({
      name: 'global.setImmediate',
    });
    expect(repairProtectedNodeRuntime(baseline)).toEqual([]);
    expect(auditNodeRuntime(baseline)).toContainEqual({
      name: 'global.setImmediate',
    });
  });
});
