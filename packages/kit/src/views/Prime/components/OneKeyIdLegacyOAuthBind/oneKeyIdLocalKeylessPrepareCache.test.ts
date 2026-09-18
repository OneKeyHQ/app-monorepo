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

describe('oneKeyIdLocalKeylessPrepareCache', () => {
  beforeEach(() => {
    clearOneKeyIdLegacyOAuthBindCaches();
  });

  test('returns a remembered result only for the same OneKey ID user', () => {
    rememberLocalKeylessPrepareResult({
      onekeyUserId: 'user-a',
      result: noLocalKeylessResult,
    });

    expect(getCachedLocalKeylessPrepareResult('user-a')).toEqual(
      noLocalKeylessResult,
    );
    expect(getCachedLocalKeylessPrepareResult('user-b')).toBeNull();
    expect(getCachedLocalKeylessPrepareResult()).toBeNull();
  });

  test('keeps other cache fields when remembering one slot', () => {
    rememberLocalKeylessPrepareResult({
      onekeyUserId: 'user-a',
      result: noLocalKeylessResult,
    });
    rememberKeylessCredentialReadyForBind('user-a');
    rememberShouldShowBindPrompt({
      onekeyUserId: 'user-a',
      shouldShow: true,
    });

    expect(getCachedLocalKeylessPrepareResult('user-a')).toEqual(
      noLocalKeylessResult,
    );
    expect(getCachedKeylessCredentialReadyForBind('user-a')).toBe(true);
    expect(getCachedShouldShowBindPrompt('user-a')).toBe(true);
  });

  test('remembers credential readiness only for the same OneKey ID user', () => {
    rememberKeylessCredentialReadyForBind('user-a');

    expect(getCachedKeylessCredentialReadyForBind('user-a')).toBe(true);
    expect(getCachedKeylessCredentialReadyForBind('user-b')).toBe(false);
    expect(getCachedKeylessCredentialReadyForBind()).toBe(false);
  });

  test('can remember that the bind card should stay hidden', () => {
    rememberShouldShowBindPrompt({
      onekeyUserId: 'user-a',
      shouldShow: false,
    });

    expect(getCachedShouldShowBindPrompt('user-a')).toBe(false);
    expect(getCachedShouldShowBindPrompt('user-b')).toBeUndefined();
  });

  test('clears prepare, readiness, and visibility caches together', () => {
    rememberLocalKeylessPrepareResult({
      onekeyUserId: 'user-a',
      result: noLocalKeylessResult,
    });
    rememberKeylessCredentialReadyForBind('user-a');
    rememberShouldShowBindPrompt({
      onekeyUserId: 'user-a',
      shouldShow: true,
    });
    clearOneKeyIdLegacyOAuthBindCaches();

    expect(getCachedLocalKeylessPrepareResult('user-a')).toBeNull();
    expect(getCachedKeylessCredentialReadyForBind('user-a')).toBe(false);
    expect(getCachedShouldShowBindPrompt('user-a')).toBeUndefined();
  });
});
