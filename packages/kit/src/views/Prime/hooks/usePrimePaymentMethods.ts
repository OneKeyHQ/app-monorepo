// load stripe js before revenuecat, otherwise revenuecat will create script tag load https://js.stripe.com/v3
// eslint-disable-next-line import/order
import '@onekeyhq/shared/src/modules3rdParty/stripe-v3';

import { usePrimePaymentMethodsWeb } from './usePrimePaymentMethodsWeb';

export const usePrimePaymentMethods = usePrimePaymentMethodsWeb;
