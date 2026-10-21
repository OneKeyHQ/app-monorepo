export const INITIAL_OFFSET = 8;
export const INITIAL_STEP = 8;

type Probe = (i: number, skipResult?: boolean) => Promise<boolean>;

export class Tracker {
  private pending = new Set<Promise<unknown>>();
  private errors: unknown[] = [];

  add<T>(p: Promise<T>): Promise<T> {
    // Wrap promise to catch errors and prevent unhandled rejections
    const tracked = p.catch((err) => {
      this.errors.push(err);
      throw err; // Re-throw so callers who await can still catch
    });
    this.pending.add(tracked);
    void tracked.catch(() => {}).finally(() => this.pending.delete(tracked));
    return p; // Return original so caller gets the actual result/error
  }

  async wait(): Promise<void> {
    while (this.pending.size > 0) {
      // Wait for one to settle (not reject), then re-check. The catch is so the race isn't rejecting
      // immediately. When adding a promise there's a catch to register the error, and below there's a check
      await Promise.race([...this.pending].map((p) => p.catch(() => {})));
    }
    // If any errors occurred, throw the first one
    if (this.errors.length > 0) {
      throw this.errors[0];
    }
  }
}

async function touch(
  probe: Probe,
  start: number,
  end: number,
  tracker?: Tracker,
  lengthOnly?: boolean
) {
  if (lengthOnly) return;
  const tr = tracker ?? new Tracker();
  for (let i = start; i < end; i++) {
    void tr.add(probe(i, true)); // skipResult=true: check nullifier first
  }

  if (!tracker) await tr.wait();
}

export async function bisect(
  probe: Probe,
  start: number,
  end: number,
  tracker?: Tracker,
  lengthOnly?: boolean
) {
  if (start >= end) return; // base case: nothing to search
  const tr = tracker ?? new Tracker();
  const mid = Math.floor((start + end) / 2);
  if (await tr.add(probe(mid))) {
    void touch(probe, start, mid, tr, lengthOnly);
    void bisect(probe, mid + 1, end, tr, lengthOnly);
  } else {
    void bisect(probe, start, mid, tr, lengthOnly);
  }
  if (!tracker) await tr.wait();
}

export async function scan(probe: Probe, start: number, tracker?: Tracker, lengthOnly?: boolean) {
  const tr = tracker ?? new Tracker();
  let offset = INITIAL_OFFSET;
  let step = INITIAL_STEP;
  let prev = -1;
  let index;

  // loop until an empty slot (generator returns false)
  while (true) {
    index = start + offset;
    if (!(await tr.add(probe(index)))) break;

    // (prev, index) have values
    void touch(probe, prev + 1, index, tr, lengthOnly);

    prev = index;
    offset += step;
    step *= 2;
  }
  void bisect(probe, prev + 1, index, tr, lengthOnly);
  if (!tracker) await tr.wait();
}
