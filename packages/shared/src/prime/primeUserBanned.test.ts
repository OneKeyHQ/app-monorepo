import { EPrimeEmailOTPScene } from '../consts/primeConsts';

import {
  isOneKeyIdFeatureRequest,
  isPrimeBannedAccountRecoveryRequest,
  isPrimeUserBannedError,
} from './primeUserBanned';

describe('Prime account restrictions', () => {
  it('limits OneKey ID services while preserving ordinary wallet requests', () => {
    expect(
      isOneKeyIdFeatureRequest(
        '/wallet/v1/account/transaction/export-task/create',
      ),
    ).toBe(true);
    expect(isOneKeyIdFeatureRequest('/rebate/v1/user/info')).toBe(true);
    expect(
      isOneKeyIdFeatureRequest('/wallet/v1/account/transaction/history'),
    ).toBe(false);
  });
  test.each([
    { code: 90_012 },
    { data: { code: '90012' } },
    { response: { data: { code: 90_012 } } },
  ])('recognizes the ban code in serialized server errors: %j', (error) =>
    expect(isPrimeUserBannedError(error)).toBe(true),
  );

  test.each([
    null,
    undefined,
    {},
    { code: 90_300 },
    { data: { code: 90_002 } },
  ])('keeps other errors unchanged: %j', (error) =>
    expect(isPrimeUserBannedError(error)).toBe(false),
  );

  test.each([
    [
      'post',
      '/prime/v1/general/emailOTP',
      JSON.stringify({ scene: EPrimeEmailOTPScene.DeleteOneKeyId }),
    ],
    ['post', '/prime/v1/user/delete', undefined],
    ['post', '/prime/v1/user/logout', undefined],
    ['post', '/prime/v1/user/login', undefined],
    ['post', '/prime/v1/account/oauth/login', undefined],
    ['get', '/prime/v1/account/profile', undefined],
    ['get', '/prime/v1/user/info', undefined],
    [
      'post',
      '/prime/v1/general/emailOTP',
      { scene: EPrimeEmailOTPScene.DeleteOneKeyId },
    ],
  ])('preserves recovery: %s %s', (method, url, data) => {
    expect(isPrimeBannedAccountRecoveryRequest({ method, url, data })).toBe(
      true,
    );
  });

  test.each([
    ['post', '/prime/v1/account/identities/oauth/bind', undefined],
    ['post', '/prime/v1/general/emailOTP', { scene: 'ChangePassword' }],
    ['get', '/prime/v1/user/delete', undefined],
    ['get', '/prime/v1/user/devices', undefined],
    ['post', '/prime/v1/redeem', undefined],
    ['post', '/prime/v1/sync/upload', undefined],
  ])('blocks other account features: %s %s', (method, url, data) => {
    expect(isPrimeBannedAccountRecoveryRequest({ method, url, data })).toBe(
      false,
    );
  });
});
