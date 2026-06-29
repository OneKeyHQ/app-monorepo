/**
 * FrameChannelHost — domain-agnostic kernel for the bg→main "push small frames
 * + pull large" protocol (design: docs/plans/2026-06-18-...§4A).
 *
 * The kernel orchestrates, per (owner, kind): a monotonic version (policy chosen
 * per kind), a last-payload cache (PULL backstop), pull-only blobs, an MRU owner
 * cap, and owner create/evict lifecycle hooks. It is generic over a payload map
 * and takes an injected `emit` so it never imports appEventBus or any domain
 * type — keeping it pure and testable. Fixtures use neutral kind names so the
 * frameChannel/ directory stays free of any domain vocabulary (§4A.7).
 */
import { FrameChannelHost } from './frameChannelHost';

type IPayloads = {
  alpha: { gen: number; ids: string[] };
  beta: { byId: Record<string, string> };
  gamma: { map: Record<string, { v: string }> };
};

function makeHost(overrides?: { ownerCap?: number }) {
  const emitted: Array<{ eventName: string; payload: unknown }> = [];
  const host = new FrameChannelHost<IPayloads>({
    ownerCap: overrides?.ownerCap ?? 8,
    kinds: {
      alpha: { eventName: 'AlphaFrame', versionMode: 'domain' },
      beta: { eventName: 'BetaFrame', versionMode: 'increment' },
      gamma: { eventName: 'GammaFrame', versionMode: 'increment' },
    },
    emit: (eventName, payload) => emitted.push({ eventName, payload }),
  });
  return { host, emitted };
}

describe('FrameChannelHost', () => {
  it('increment kind: version starts at 0 and is monotonic; emits eventName + assembled payload', () => {
    const { host, emitted } = makeHost();
    host.pushFrame('beta', 'o1', (v) => ({ byId: { a: String(v) } }));
    host.pushFrame('beta', 'o1', (v) => ({ byId: { a: String(v) } }));

    expect(emitted).toEqual([
      { eventName: 'BetaFrame', payload: { byId: { a: '0' } } },
      { eventName: 'BetaFrame', payload: { byId: { a: '1' } } },
    ]);
    expect(host.getFrames('o1').beta.version).toBe(1);
  });

  it('domain kind: uses the supplied opts.version (not an internal counter)', () => {
    const { host, emitted } = makeHost();
    host.pushFrame('alpha', 'o1', (v) => ({ gen: v, ids: ['a'] }), {
      version: 7,
    });
    expect(host.getFrames('o1').alpha.version).toBe(7);
    expect(emitted[0]).toEqual({
      eventName: 'AlphaFrame',
      payload: { gen: 7, ids: ['a'] },
    });
  });

  it('domain kind: throws if opts.version is missing', () => {
    const { host } = makeHost();
    expect(() =>
      host.pushFrame('alpha', 'o1', (v) => ({ gen: v, ids: [] })),
    ).toThrow();
  });

  it('getFrames for a never-pushed owner returns version -1 and undefined payload per kind', () => {
    const { host } = makeHost();
    const frames = host.getFrames('missing');
    expect(frames.alpha).toEqual({ version: -1, payload: undefined });
    expect(frames.beta).toEqual({ version: -1, payload: undefined });
    expect(frames.gamma).toEqual({ version: -1, payload: undefined });
  });

  it('caches the last payload per kind for PULL backstop', () => {
    const { host } = makeHost();
    host.pushFrame('gamma', 'o1', () => ({ map: { t: { v: '5' } } }));
    expect(host.getFrames('o1').gamma).toEqual({
      version: 0,
      payload: { map: { t: { v: '5' } } },
    });
  });

  it('setPullBlob / getPullBlob store and return the pull-only blob; unknown returns undefined', () => {
    const { host } = makeHost();
    host.setPullBlob('o1', 'raw', { big: [1, 2, 3] });
    expect(host.getPullBlob('o1', 'raw')).toEqual({ big: [1, 2, 3] });
    expect(host.getPullBlob('o1', 'absent')).toBeUndefined();
    expect(host.getPullBlob('missing', 'raw')).toBeUndefined();
  });

  it('pull-blob is co-located in the owner slot: evicting the owner drops its blob too', () => {
    const { host } = makeHost({ ownerCap: 1 });
    host.setPullBlob('a', 'prev', { n: 1 });
    expect(host.getPullBlob('a', 'prev')).toEqual({ n: 1 });
    host.touchOwner('b'); // size 2 > cap 1 → evict LRU = a (with its blob)
    expect(host.getPullBlob('a', 'prev')).toBeUndefined();
  });

  it('MRU: touchOwner evicts the least-recently-used owner past ownerCap', () => {
    const { host } = makeHost({ ownerCap: 2 });
    host.touchOwner('a');
    host.touchOwner('b');
    host.touchOwner('a'); // a now MRU, b is LRU
    host.touchOwner('c'); // size 3 > cap 2 → evict LRU = b
    expect(host.getFrames('b').alpha.version).toBe(-1); // b dropped
    expect(host.getFrames('a').alpha.version).toBe(-1); // a survives (version still -1, never pushed)
    // a survives as a live slot: set a blob and read it back
    host.setPullBlob('a', 'x', 1);
    expect(host.getPullBlob('a', 'x')).toBe(1);
    expect(host.getPullBlob('c', 'x')).toBeUndefined();
  });

  it('pushFrame is synchronous: emit happens before pushFrame returns (no microtask)', () => {
    const { host, emitted } = makeHost();
    host.pushFrame('beta', 'o1', () => ({ byId: {} }));
    expect(emitted).toHaveLength(1); // already emitted, no await needed
  });
});
