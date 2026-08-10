import { EDeviceType } from '@onekeyfe/hd-shared';

import ServiceNFT from './ServiceNFT';

import type { DeviceUploadResourceParams } from '@onekeyfe/hd-core';

const previousBackgroundScope = globalThis.$onekeyIsInBackground;

beforeAll(() => {
  globalThis.$onekeyIsInBackground = true;
});

afterAll(() => {
  globalThis.$onekeyIsInBackground = previousBackgroundScope;
});

const uploadResParams = {
  resType: 1,
  suffix: 'jpg',
  dataHex: 'full-image',
  thumbnailDataHex: 'thumbnail-image',
  blurDataHex: 'blur-image',
  nftMetaData: 'metadata',
} as DeviceUploadResourceParams;

function buildService(deviceType: EDeviceType) {
  const uploadPro2Nft = jest.fn(async () => ({ nftUpdated: true }));
  const uploadResource = jest.fn(async () => ({ message: 'Success' }));
  const backgroundApi = {
    servicePassword: {
      promptPasswordVerifyByAccount: jest.fn(async () => ({
        deviceParams: {
          dbDevice: { connectId: 'device-connect-id', deviceType },
        },
      })),
    },
    serviceHardware: { uploadPro2Nft, uploadResource },
    serviceHardwareUI: {
      withHardwareProcessing: jest.fn(async (action: () => Promise<unknown>) =>
        action(),
      ),
    },
  };
  return {
    service: new ServiceNFT({ backgroundApi }),
    uploadPro2Nft,
    uploadResource,
  };
}

describe('ServiceNFT Pro2 upload routing', () => {
  it('routes Pro2 images and metadata to deviceUploadNft', async () => {
    const { service, uploadPro2Nft, uploadResource } = buildService(
      EDeviceType.Pro2,
    );

    await service.uploadNFTImageToDevice({
      accountId: 'account-id',
      pro2UploadParams: {
        imageHex: 'full-image',
        thumbnailHex: 'thumbnail-image',
        title: 'NFT #1',
        subtitle: 'Collection',
      },
    });

    expect(uploadPro2Nft).toHaveBeenCalledWith({
      connectId: 'device-connect-id',
      imageHex: 'full-image',
      thumbnailHex: 'thumbnail-image',
      title: 'NFT #1',
      subtitle: 'Collection',
    });
    expect(uploadResource).not.toHaveBeenCalled();
  });

  it('keeps legacy ResourceUpload for Pro1 devices', async () => {
    const { service, uploadPro2Nft, uploadResource } = buildService(
      EDeviceType.Pro,
    );

    await service.uploadNFTImageToDevice({
      accountId: 'account-id',
      uploadResParams,
    });

    expect(uploadResource).toHaveBeenCalledWith(
      'device-connect-id',
      uploadResParams,
    );
    expect(uploadPro2Nft).not.toHaveBeenCalled();
  });

  it('treats an existing Pro2 NFT as an idempotent success', async () => {
    const { service, uploadPro2Nft } = buildService(EDeviceType.Pro2);
    const error = Object.assign(
      new Error('Failure_DataError,NFT already exists : 800'),
      {
        payload: {
          code: 800,
          error: 'Failure_DataError,NFT already exists',
        },
      },
    );
    uploadPro2Nft.mockImplementationOnce(async () => {
      throw error;
    });

    await expect(
      service.uploadNFTImageToDevice({
        accountId: 'account-id',
        pro2UploadParams: {
          imageHex: 'full-image',
          thumbnailHex: 'thumbnail-image',
          title: 'NFT #1',
          subtitle: 'Collection',
        },
      }),
    ).resolves.toEqual({
      nftUpdated: true,
      message: 'NFT already exists',
    });
  });

  it('keeps other Pro2 data errors as failures', async () => {
    const { service, uploadPro2Nft } = buildService(EDeviceType.Pro2);
    const error = Object.assign(new Error('Failure_DataError,Invalid NFT'), {
      payload: {
        code: 800,
        error: 'Failure_DataError,Invalid NFT',
      },
    });
    uploadPro2Nft.mockImplementationOnce(async () => {
      throw error;
    });

    await expect(
      service.uploadNFTImageToDevice({
        accountId: 'account-id',
        pro2UploadParams: {
          imageHex: 'full-image',
          thumbnailHex: 'thumbnail-image',
          title: 'NFT #1',
          subtitle: 'Collection',
        },
      }),
    ).rejects.toBe(error);
  });

  it('rejects a Pro2 upload before touching the legacy resource path', async () => {
    const { service, uploadPro2Nft, uploadResource } = buildService(
      EDeviceType.Pro2,
    );

    await expect(
      service.uploadNFTImageToDevice({ accountId: 'account-id' }),
    ).rejects.toThrow('Pro2 NFT upload parameters are required');
    expect(uploadPro2Nft).not.toHaveBeenCalled();
    expect(uploadResource).not.toHaveBeenCalled();
  });

  it('rejects a legacy upload without legacy resource parameters', async () => {
    const { service, uploadPro2Nft, uploadResource } = buildService(
      EDeviceType.Pro,
    );

    await expect(
      service.uploadNFTImageToDevice({ accountId: 'account-id' }),
    ).rejects.toThrow('Legacy NFT upload parameters are required');
    expect(uploadPro2Nft).not.toHaveBeenCalled();
    expect(uploadResource).not.toHaveBeenCalled();
  });
});
