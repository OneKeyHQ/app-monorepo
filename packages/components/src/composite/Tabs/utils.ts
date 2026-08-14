export const startViewTransition = (fn: () => void) => {
  if (typeof document !== 'undefined' && document.startViewTransition) {
    const transition = document.startViewTransition(fn);
    void transition.ready.catch((error: unknown) => {
      if (
        error instanceof Error &&
        error.name === 'AbortError' &&
        error.message === 'Transition was skipped'
      ) {
        return;
      }
      queueMicrotask(() => {
        throw error;
      });
    });
  } else {
    fn();
  }
};

export const parseCssSize = (value: string | undefined) => {
  const size = Number.parseFloat(value ?? '');
  return Number.isFinite(size) ? size : 0;
};
