export const startViewTransition = (fn: () => void) => {
  if (typeof document !== 'undefined' && document.startViewTransition) {
    document.startViewTransition(fn);
  } else {
    fn();
  }
};
