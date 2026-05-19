export const startViewTransition = (fn: () => void) => {
  if (typeof document !== 'undefined' && document.startViewTransition) {
    document.startViewTransition(fn);
  } else {
    fn();
  }
};

export const parseCssSize = (value: string | undefined) => {
  const size = Number.parseFloat(value ?? '');
  return Number.isFinite(size) ? size : 0;
};
