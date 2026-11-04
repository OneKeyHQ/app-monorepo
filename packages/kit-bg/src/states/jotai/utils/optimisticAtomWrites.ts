import { isEqual } from 'lodash';

// Bookkeeping for `JotaiCrossAtom.setOptimistic` on split runtimes (extension
// UI, native main with the background thread). The UI applies a value locally
// and forwards it to bg; bg later echoes every accepted write back. Two things
// go wrong without this record: an echo of an older write arrives after the
// user already changed the value again and flips the UI back until the newer
// echo lands, and a rejected forward (Travel Mode, bridge not ready) leaves
// the UI on a value bg never accepted.

type IPendingOptimisticWrite = {
  seq: number;
  value: unknown;
};

type IOptimisticAtomState = {
  // Forwards to bg that have not settled yet, oldest first.
  pending: IPendingOptimisticWrite[];
  // The last value bg is known to hold: the UI value before the first
  // optimistic apply, then the payload of every forward that resolved.
  authoritativeValue: unknown;
};

const stateByAtom = new Map<string, IOptimisticAtomState>();
let seqCounter = 0;

// What the UI should show: the newest write still waiting on bg, otherwise the
// last value bg accepted.
function getExpectedValue(state: IOptimisticAtomState) {
  return state.pending.length
    ? state.pending[state.pending.length - 1].value
    : state.authoritativeValue;
}

export function beginOptimisticAtomWrite({
  name,
  value,
  currentValue,
}: {
  name: string;
  value: unknown;
  currentValue: unknown;
}) {
  let state = stateByAtom.get(name);
  if (!state) {
    state = { pending: [], authoritativeValue: currentValue };
    stateByAtom.set(name, state);
  }
  seqCounter += 1;
  state.pending.push({ seq: seqCounter, value });
  return seqCounter;
}

// Returns the value the UI should show once this forward has settled, so the
// caller can restore it when the optimistic value is no longer right.
export function settleOptimisticAtomWrite({
  name,
  seq,
  resolved,
}: {
  name: string;
  seq: number;
  resolved: boolean;
}): { expectedValue: unknown } | undefined {
  const state = stateByAtom.get(name);
  if (!state) {
    return undefined;
  }
  const index = state.pending.findIndex((write) => write.seq === seq);
  if (index === -1) {
    return undefined;
  }
  const [write] = state.pending.splice(index, 1);
  if (resolved) {
    state.authoritativeValue = write.value;
  }
  const expectedValue = getExpectedValue(state);
  if (!state.pending.length) {
    stateByAtom.delete(name);
  }
  return { expectedValue };
}

// While forwards are in flight, a bg echo that does not carry the newest local
// value is an echo of an older write (or of a bg-side write the pending
// forward is about to overwrite); applying it would flip the UI back until the
// next echo arrives. Once nothing is pending every echo applies again.
export function shouldIgnoreBgEchoForOptimisticWrite(
  name: string,
  payload: unknown,
) {
  const state = stateByAtom.get(name);
  if (!state?.pending.length) {
    return false;
  }
  return !isEqual(payload, getExpectedValue(state));
}
