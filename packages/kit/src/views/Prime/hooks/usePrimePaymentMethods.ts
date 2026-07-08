// IMPORTANT: keep Stripe as an eager top-level import before RevenueCat.
// RevenueCat checks for a preloaded Stripe.js runtime; if this is moved to a
// lazy import for startup performance, RevenueCat may inject
// https://js.stripe.com/v3 itself and Prime checkout can break.
// eslint-disable-next-line import-js/order
import '@onekeyhq/shared/src/modules3rdParty/stripe-v3';

import { usePrimePaymentMethodsWeb } from './usePrimePaymentMethodsWeb';

export const usePrimePaymentMethods = usePrimePaymentMethodsWeb;
