/** @jest-environment jsdom */

import {
  PRIME_SUBSCRIPTION_EXT_HANDOFF_QUERY,
  PRIME_SUBSCRIPTION_EXT_HANDOFF_VALUE,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';

import { consumePrimeSubscriptionHandoffFromUrl } from './primeSubscriptionExtHandoff';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isExtensionUiExpandTab: true,
  },
}));

describe('consumePrimeSubscriptionHandoffFromUrl', () => {
  beforeEach(() => {
    globalThis.history.replaceState(null, '', '#/');
  });

  it('consumes the expand-tab handoff and strips it from the hash', () => {
    globalThis.history.replaceState(
      null,
      '',
      `#/?${PRIME_SUBSCRIPTION_EXT_HANDOFF_QUERY}=${PRIME_SUBSCRIPTION_EXT_HANDOFF_VALUE}&keep=true`,
    );

    expect(consumePrimeSubscriptionHandoffFromUrl()).toBe(true);
    expect(globalThis.location.hash).toBe('#/?keep=true');
  });

  it('ignores a hash without the handoff flag', () => {
    globalThis.history.replaceState(null, '', '#/?keep=true');

    expect(consumePrimeSubscriptionHandoffFromUrl()).toBe(false);
    expect(globalThis.location.hash).toBe('#/?keep=true');
  });

  it('ignores a handoff flag with the wrong value', () => {
    globalThis.history.replaceState(
      null,
      '',
      `#/?${PRIME_SUBSCRIPTION_EXT_HANDOFF_QUERY}=0`,
    );

    expect(consumePrimeSubscriptionHandoffFromUrl()).toBe(false);
    expect(globalThis.location.hash).toBe(
      `#/?${PRIME_SUBSCRIPTION_EXT_HANDOFF_QUERY}=0`,
    );
  });
});
