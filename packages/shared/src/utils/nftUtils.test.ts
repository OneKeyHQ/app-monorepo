/* eslint-disable import/first */

const mockHardwareTransportModuleLoaded = jest.fn();

jest.mock('@onekeyfe/hd-transport', () => {
  mockHardwareTransportModuleLoaded();
  return {
    ResourceType: {
      Nft: 1,
    },
  };
});

import { generateUploadNFTParams } from './nftUtils';

import type { INFTMetaData } from '../../types/nft';

describe('nftUtils', () => {
  it('uses the NFT hardware wire type without a runtime transport import', async () => {
    const params = await generateUploadNFTParams({
      blurScreenHex: '03',
      metadata: {} as INFTMetaData,
      screenHex: '01',
      thumbnailHex: '02',
    });

    expect(params.resType).toBe(1);
    expect(mockHardwareTransportModuleLoaded).not.toHaveBeenCalled();
  });
});
