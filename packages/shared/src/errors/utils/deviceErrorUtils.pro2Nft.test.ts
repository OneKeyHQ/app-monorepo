import {
  NftStorageLimitReachedError,
  PRO2_NFT_STORAGE_LIMIT_REACHED_ERROR_CODE,
} from '../errors/hardwareErrors';

import { convertDeviceError } from './deviceErrorUtils';

describe('convertDeviceError Pro2 NFT storage limit', () => {
  it('preserves the SDK storage-limit error for the NFT upload UI', () => {
    const error = convertDeviceError({
      code: PRO2_NFT_STORAGE_LIMIT_REACHED_ERROR_CODE,
      error:
        'NFT storage limit reached. Remove an NFT from the device and try again.',
      params: { count: 10, limit: 10 },
    });

    expect(error).toBeInstanceOf(NftStorageLimitReachedError);
    expect(error).toMatchObject({
      code: PRO2_NFT_STORAGE_LIMIT_REACHED_ERROR_CODE,
      message:
        'NFT storage limit reached. Remove an NFT from the device and try again.',
      payload: {
        code: PRO2_NFT_STORAGE_LIMIT_REACHED_ERROR_CODE,
        params: { count: 10, limit: 10 },
      },
    });
  });
});
