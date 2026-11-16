/* global repairIntrinsics, HermesInternal */
// Match the pinned React Native adapter's repair options and Hermes Promise
// restoration, while retaining OneKey's locale-aware comparison and formatting.
// Metro executes this as a raw prelude before require or Babel helpers exist.
(function () {
  const originalError = Error;
  const nativeStackFormatter = Object.getOwnPropertyDescriptor(
    originalError,
    'prepareStackTrace',
  );
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

  // Hermes exposes captureStackTrace, but its CallSite objects do not implement
  // V8's string formatter. SES's V8 formatter otherwise emits [object CallSite]
  // and loses every location needed by the native Sentry parser. Restore only
  // the original formatter before hardening; retain SES's constructor taming.
  if (
    typeof HermesInternal === 'object' &&
    typeof originalError.captureStackTrace === 'function'
  ) {
    if (nativeStackFormatter) {
      Object.defineProperty(
        originalError,
        'prepareStackTrace',
        nativeStackFormatter,
      );
    } else {
      delete originalError.prepareStackTrace;
    }
  }

  Object.assign(Promise, Object.fromEntries(promiseInternals));
})();
