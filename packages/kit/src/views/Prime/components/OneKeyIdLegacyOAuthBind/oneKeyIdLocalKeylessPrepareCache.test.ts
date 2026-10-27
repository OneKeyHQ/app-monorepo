import { EOneKeyIdLoginWithLocalKeylessPrepareStatus } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';

import {
  clearOneKeyIdLegacyOAuthBindCaches,
  getCachedKeylessCredentialReadyForBind,
  getCachedLocalKeylessPrepareResult,
  getCachedShouldShowBindPrompt,
  rememberKeylessCredentialReadyForBind,
  rememberLocalKeylessPrepareResult,
  rememberShouldShowBindPrompt,
} from './oneKeyIdLocalKeylessPrepareCache';

const noLocalKeylessResult = {
  status: EOneKeyIdLoginWithLocalKeylessPrepareStatus.NoLocalKeyless,
};

function rememberAllSlots(onekeyUserId: string) {
  rememberLocalKeylessPrepareResult({
    onekeyUserId,
    result: noLocalKeylessResult,
  });
  rememberKeylessCredentialReadyForBind(onekeyUserId);
  rememberShouldShowBindPrompt({
    onekeyUserId,
    shouldShow: true,
  });
}

describe('oneKeyIdLocalKeylessPrepareCache', () => {
  beforeEach(() => {
    clearOneKeyIdLegacyOAuthBindCaches();
  });

  test('isolates cache by user and drops the previous user after a switch', () => {
    rememberAllSlots('user-a');

    expect(getCachedLocalKeylessPrepareResult('user-a')).toEqual(
      noLocalKeylessResult,
    );
    expect(getCachedKeylessCredentialReadyForBind('user-a')).toBe(true);
    expect(getCachedShouldShowBindPrompt('user-a')).toBe(true);
    expect(getCachedLocalKeylessPrepareResult('user-b')).toBeNull();
    expect(getCachedKeylessCredentialReadyForBind('user-b')).toBe(false);
    expect(getCachedShouldShowBindPrompt('user-b')).toBeUndefined();
    expect(getCachedLocalKeylessPrepareResult()).toBeNull();
    expect(getCachedKeylessCredentialReadyForBind()).toBe(false);
    expect(getCachedShouldShowBindPrompt()).toBeUndefined();

    rememberAllSlots('user-b');

    expect(getCachedLocalKeylessPrepareResult('user-a')).toBeNull();
    expect(getCachedKeylessCredentialReadyForBind('user-a')).toBe(false);
    expect(getCachedShouldShowBindPrompt('user-a')).toBeUndefined();
    expect(getCachedLocalKeylessPrepareResult('user-b')).toEqual(
      noLocalKeylessResult,
    );
    expect(getCachedKeylessCredentialReadyForBind('user-b')).toBe(true);
    expect(getCachedShouldShowBindPrompt('user-b')).toBe(true);
  });

  test('clears prepare, readiness, and visibility caches together', () => {
    rememberAllSlots('user-a');
    clearOneKeyIdLegacyOAuthBindCaches();

    expect(getCachedLocalKeylessPrepareResult('user-a')).toBeNull();
    expect(getCachedKeylessCredentialReadyForBind('user-a')).toBe(false);
    expect(getCachedShouldShowBindPrompt('user-a')).toBeUndefined();
  });
});
