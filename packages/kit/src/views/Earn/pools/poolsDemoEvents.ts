// Lets screens that show Pools data refresh in place after a demo reset or an
// abandoned task, without waiting for the next focus. UI runtime only.
type IListener = () => void;

const listeners = new Set<IListener>();

export function onPoolsDataChanged(listener: IListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitPoolsDataChanged() {
  listeners.forEach((listener) => listener());
}
