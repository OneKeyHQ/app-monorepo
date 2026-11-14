import { OneKeyLocalError } from '../../errors';

export default function loadSes(): void {
  // Native SES must come from the untransformed Hermes Metro prelude. Loading
  // the web shim here would introduce a second SES instance and safe-eval
  // semantics that Hermes cannot support.
  throw new OneKeyLocalError(
    'Mobile SES must be enabled at build time with ONEKEY_MOBILE_LOCKDOWN=true.',
  );
}
