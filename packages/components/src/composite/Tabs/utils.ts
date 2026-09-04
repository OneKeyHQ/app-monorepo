export const startViewTransition = (fn: () => void) => {
  if (typeof document !== 'undefined' && document.startViewTransition) {
    const transition = document.startViewTransition(fn);
    void transition.ready.catch((error: unknown) => {
      // Per spec, a skipped view transition (hidden page, superseded by a
      // concurrent transition, etc.) rejects `ready` with an AbortError. The
      // message text is engine-specific (Chromium says "Transition was
      // skipped", Safari/Firefox use different wording), so match only the
      // error name and rethrow everything else as a global error.
      if (error instanceof Error && error.name === 'AbortError') {
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
