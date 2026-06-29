/**
 * FrameSubscriberGate — the pure, React-free monotonic version gate the
 * subscriber side uses to drop stale frames per kind (design §4A.3). One gate
 * per (store, owner) pass; `reset()` on owner switch so the new owner's first
 * (low-version) frame is not dropped. A `floorVersion` lets a kind ignore
 * versions below a floor (e.g. an unknown-owner -1 PULL).
 */
import { FrameSubscriberGate } from './frameSubscriberGate';

describe('FrameSubscriberGate', () => {
  it('accepts a strictly-higher version and records it; drops equal-or-lower', () => {
    const gate = new FrameSubscriberGate({ a: {}, b: {} });
    expect(gate.accept('a', 0)).toBe(true); // first real frame
    expect(gate.accept('a', 0)).toBe(false); // duplicate
    expect(gate.accept('a', 1)).toBe(true); // newer
    expect(gate.accept('a', 1)).toBe(false); // not strictly higher
    // kinds are independent
    expect(gate.accept('b', 0)).toBe(true);
  });

  it('drops a version below the floor (e.g. unknown-owner -1 PULL)', () => {
    const gate = new FrameSubscriberGate({ risky: { floorVersion: 0 } });
    expect(gate.accept('risky', -1)).toBe(false); // below floor
    expect(gate.accept('risky', 0)).toBe(true);
  });

  it('drops the initial -1 even without an explicit floor (last starts at -1)', () => {
    const gate = new FrameSubscriberGate({ a: {} });
    expect(gate.accept('a', -1)).toBe(false);
  });

  it('reset() re-arms the gate so a lower version is accepted again (owner switch)', () => {
    const gate = new FrameSubscriberGate({ a: {} });
    expect(gate.accept('a', 5)).toBe(true);
    expect(gate.accept('a', 3)).toBe(false); // stale for the old owner
    gate.reset();
    expect(gate.accept('a', 0)).toBe(true); // new owner starts low again
  });
});
