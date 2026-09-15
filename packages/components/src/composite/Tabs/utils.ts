export const startViewTransition = (fn: () => void) => {
  if (typeof document !== 'undefined' && document.startViewTransition) {
    void document.startViewTransition(fn).ready.catch((error: DOMException) => {
      if (!['AbortError', 'InvalidStateError'].includes(error.name)) {
        throw error;
      }
    });
  } else {
    fn();
  }
};

export const parseCssSize = (value: string | undefined) => {
  const size = Number.parseFloat(value ?? '');
  return Number.isFinite(size) ? size : 0;
};
