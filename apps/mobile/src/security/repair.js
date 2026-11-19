/* global repairIntrinsics, HermesInternal */
// Retain the adapter's Hermes Promise restoration and OneKey's native
// evaluation, locale-aware comparison and formatting.
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
    // Hardware SDK protobuf schemas compile their codecs with Function().
    // Keep native evaluation available while SES still freezes intrinsics.
    evalTaming: 'unsafe-eval',
    localeTaming: 'unsafe',
  });

  function restoreNativeStackFormatter() {
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

  // Hermes exposes captureStackTrace, but its CallSite objects do not implement
  // V8's string formatter. SES's V8 formatter otherwise emits [object CallSite]
  // and loses every location needed by the native Sentry parser. Restore only
  // the original formatter before hardening; retain SES's constructor taming.
  if (
    typeof HermesInternal === 'object' &&
    typeof originalError.captureStackTrace === 'function'
  ) {
    const tamedStackFormatter = Object.getOwnPropertyDescriptor(
      Error,
      'prepareStackTrace',
    );
    // React temporarily clears this hook while collecting component stacks.
    // SES resets undefined to its V8 formatter, so preserve Hermes's native
    // reset semantics while retaining SES's attenuation of custom callbacks.
    Object.defineProperty(Error, 'prepareStackTrace', {
      get: tamedStackFormatter.get,
      set(value) {
        if (typeof value === 'function')
          tamedStackFormatter.set.call(this, value);
        else restoreNativeStackFormatter();
      },
      enumerable: tamedStackFormatter.enumerable,
      configurable: true,
    });
    restoreNativeStackFormatter();
  }

  Object.assign(Promise, Object.fromEntries(promiseInternals));
})();
