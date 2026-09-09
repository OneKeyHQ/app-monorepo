/* eslint-disable import/first */

const mockGenerateUUID = jest.fn((options?: { removeDashes?: boolean }) => {
  const uuid = '00000000-0000-4000-8000-000000000000';
  return options?.removeDashes ? uuid.replace(/-/g, '') : uuid;
});

jest.mock('@onekeyhq/shared/src/utils/stringUtils', () => ({
  __esModule: true,
  default: {
    generateUUID: (options: { removeDashes?: boolean }) =>
      mockGenerateUUID(options),
  },
}));

import purchaseSdkUtils from './purchaseSdkUtils';

describe('purchaseSdkUtils', () => {
  it('generates a RevenueCat-compatible anonymous app user ID', () => {
    expect(purchaseSdkUtils.generateRevenueCatAnonymousAppUserId()).toBe(
      '$RCAnonymousID:00000000000040008000000000000000',
    );
    expect(mockGenerateUUID).toHaveBeenCalledWith({ removeDashes: true });
  });
});
