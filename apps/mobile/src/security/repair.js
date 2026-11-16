/* global repairIntrinsics */
// Match the pinned React Native adapter's repair options and Hermes Promise
// restoration, while retaining OneKey's locale-aware comparison and formatting.
// Metro executes this as a raw prelude before require or Babel helpers exist.
const promiseInternals = Object.entries(Promise).filter(function (entry) {
  return !!entry[1] && entry[0].startsWith('_');
});

repairIntrinsics({
  errorTaming: 'unsafe',
  consoleTaming: 'unsafe',
  errorTrapping: 'none',
  unhandledRejectionTrapping: 'none',
  overrideTaming: 'severe',
  stackFiltering: 'verbose',
  evalTaming: 'unsafe-eval',
  localeTaming: 'unsafe',
});

Object.assign(Promise, Object.fromEntries(promiseInternals));
