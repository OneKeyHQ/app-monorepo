const noop = () => {};

export const perfTrace = {
  startTrace: noop,
  newTrace: noop,
};

export const bundleLoadTrace = {
  start: noop,
  stop: noop,
};
