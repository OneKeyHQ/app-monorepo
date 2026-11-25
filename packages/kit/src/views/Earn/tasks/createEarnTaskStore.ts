export function createEarnTaskStore<TState, TEvent>({
  initialState,
  reduce,
}: {
  initialState: TState;
  // A rejected event must return the same state without mutating it.
  reduce: (state: TState, event: TEvent) => TState;
}) {
  let state = initialState;
  let owner: symbol | undefined;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const update = <TResult>(
    operation: (current: TState) => { state: TState; result: TResult },
  ): TResult => {
    const next = operation(state);
    if (next.state !== state) {
      state = next.state;
      notify();
    }
    return next.result;
  };

  const dispatchBatch = (events: TEvent[]) => {
    if (!events.length) return false;
    let next = state;
    for (const event of events) {
      const updated = reduce(next, event);
      if (updated === next) return false;
      next = updated;
    }
    state = next;
    notify();
    return true;
  };

  return {
    getState: () => state,
    dispatch: (event: TEvent) => dispatchBatch([event]),
    dispatchBatch,
    update,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    acquire: (nextOwner: symbol) => {
      if (owner && owner !== nextOwner) return false;
      owner = nextOwner;
      return true;
    },
    owns: (expectedOwner: symbol) => owner === expectedOwner,
    release: (expectedOwner: symbol) => {
      if (owner === expectedOwner) owner = undefined;
    },
  };
}
